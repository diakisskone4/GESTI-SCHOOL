from django.db import transaction
from django.db.models import Prefetch, Q
from django.http import Http404, HttpResponse
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.communication.images import max_images, preparer_image
from apps.communication.models import Annonce, ImageAnnonce, Message, Notification
from apps.communication.serializers import AnnonceSerializer, MessageSerializer, NotificationSerializer
from apps.core.permissions import IsAdminOrReadOnly
from apps.core.tenancy import EtablissementScopedMixin, etablissement_actif_id, etablissements_famille_ids

User = get_user_model()


class MessageViewSet(viewsets.ModelViewSet):
    """Messagerie interne : chaque utilisateur ne voit que ses messages envoyés/reçus."""
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["lu"]

    def get_queryset(self):
        user = self.request.user
        return Message.objects.filter(Q(expediteur=user) | Q(destinataire=user)).select_related("expediteur", "destinataire")

    def perform_create(self, serializer):
        serializer.save(expediteur=self.request.user)

    @action(detail=False, methods=["get"])
    def destinataires(self, request):
        """Retourne les utilisateurs du même établissement avec vraies données (nom, rôle, email)."""
        user = request.user
        queryset = User.objects.filter(is_active=True).exclude(pk=user.pk).exclude(role=User.Role.DEVELOPPEUR).select_related("profil_employe", "profil_eleve")
        actif = etablissement_actif_id(user)
        if actif is not None:
            queryset = queryset.filter(etablissements=actif)
        elif user.est_eleve or user.est_parent:
            queryset = queryset.filter(etablissements__in=etablissements_famille_ids(user)).distinct()
        queryset = queryset.order_by("last_name", "first_name", "email")
        
        results = []
        for item in queryset:
            nom_affiche = item.get_full_name() or item.email
            role_label = item.get_role_display()
            results.append({
                "id": str(item.id),
                "full_name": nom_affiche,
                "email": item.email,
                "role": item.role,
                "role_label": role_label,
                "display_label": f"{nom_affiche} — {role_label} ({item.email})",
            })
        return Response(results)
    @action(detail=True, methods=["post"])
    def marquer_lu(self, request, pk=None):
        message = self.get_object()
        if message.destinataire != request.user:
            return Response({"detail": "Non autorisé."}, status=403)
        message.lu = True
        message.lu_le = timezone.now()
        message.save()
        return Response(self.get_serializer(message).data)

    @action(detail=False, methods=["get"])
    def non_lus(self, request):
        count = Message.objects.filter(destinataire=request.user, lu=False).count()
        return Response({"non_lus": count})


class AnnonceViewSet(EtablissementScopedMixin, viewsets.ModelViewSet):
    """Annonces : les enseignants publient pour leurs classes, l'admin pour tout l'établissement."""
    etablissement_field = "etablissement"
    queryset = Annonce.objects.select_related("auteur", "classe", "etablissement").prefetch_related(
        Prefetch("images", queryset=ImageAnnonce.objects.defer("contenu")),
    )
    serializer_class = AnnonceSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["etablissement", "public_cible", "classe", "epinglee"]
    search_fields = ["titre", "contenu"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated()]
        return super().get_permissions()

    def perform_create(self, serializer):
        user = self.request.user
        if not (user.est_admin or user.est_enseignant):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Seuls les enseignants et administrateurs peuvent publier des annonces.")
        images = self._images_envoyees(deja=0)
        annonce = serializer.save(auteur=user)
        self._enregistrer_images(annonce, images)

    def _images_envoyees(self, deja):
        """Images jointes à la requête (champ « images », plusieurs fichiers), vérifiées et redimensionnées
        AVANT tout enregistrement : une image refusée annule toute l'opération."""
        fichiers = self.request.FILES.getlist("images")
        if deja + len(fichiers) > max_images():
            raise ValidationError({"images": f"{max_images()} images au maximum par annonce."})
        return [(f.name, *preparer_image(f)) for f in fichiers]

    def _enregistrer_images(self, annonce, images):
        depart = annonce.images.count()
        ImageAnnonce.objects.bulk_create([
            ImageAnnonce(annonce=annonce, contenu=contenu, type_mime=mime, nom_fichier=nom[:255],
                         largeur=largeur, hauteur=hauteur, taille=len(contenu), ordre=depart + i)
            for i, (nom, contenu, mime, largeur, hauteur) in enumerate(images)
        ])

    def _verifier_auteur_ou_admin(self, instance):
        user = self.request.user
        if not (user.est_admin or instance.auteur_id == user.id):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Vous ne pouvez modifier ou supprimer que vos propres annonces.")

    def perform_update(self, serializer):
        """Modification : « images » ajoute des images, « images_a_retirer » (identifiants) en retire."""
        annonce = serializer.instance
        self._verifier_auteur_ou_admin(annonce)
        a_retirer = self.request.data.getlist("images_a_retirer") if hasattr(self.request.data, "getlist") \
            else self.request.data.get("images_a_retirer", [])
        restantes = annonce.images.exclude(pk__in=a_retirer).count()
        images = self._images_envoyees(deja=restantes)
        with transaction.atomic():
            serializer.save()
            annonce.images.filter(pk__in=a_retirer).delete()
            self._enregistrer_images(annonce, images)

    def perform_destroy(self, instance):
        self._verifier_auteur_ou_admin(instance)
        instance.delete()


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["canal", "type_notification", "statut", "lu"]

    def get_queryset(self):
        return Notification.objects.filter(destinataire=self.request.user)

    @action(detail=True, methods=["post"])
    def marquer_lu(self, request, pk=None):
        notif = self.get_object()
        notif.lu = True
        notif.save(update_fields=["lu"])
        return Response(self.get_serializer(notif).data)

    @action(detail=False, methods=["post"])
    def tout_marquer_lu(self, request):
        nb = self.get_queryset().filter(lu=False).update(lu=True)
        return Response({"marquees": nb})

    @action(detail=False, methods=["get"])
    def non_lues(self, request):
        return Response({"non_lues": self.get_queryset().filter(lu=False).count()})


class ImageAnnonceView(APIView):
    """Image d'une annonce, servie depuis la base de données. Publique comme le logo de l'établissement
    (une balise <img> n'envoie pas le jeton de connexion) : l'adresse contient un identifiant aléatoire
    impossible à deviner, connu seulement de ceux qui voient l'annonce."""
    permission_classes = [AllowAny]
    authentication_classes = []
    swagger_schema = None

    def get(self, request, pk):
        image = ImageAnnonce.objects.filter(pk=pk).only("contenu", "type_mime").first()
        if image is None:
            raise Http404("Image introuvable.")
        reponse = HttpResponse(bytes(image.contenu), content_type=image.type_mime)
        reponse["Cache-Control"] = "public, max-age=604800, immutable"  # le contenu d'une image ne change jamais
        return reponse
