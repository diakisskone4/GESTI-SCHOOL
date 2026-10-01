from django.db.models import Q
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.communication.models import Annonce, Message, Notification
from apps.communication.serializers import AnnonceSerializer, MessageSerializer, NotificationSerializer
from apps.core.permissions import IsAdminOrReadOnly

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
        queryset = User.objects.filter(is_active=True).exclude(pk=user.pk).select_related("profil_employe", "profil_eleve")
        if not user.est_admin and user.etablissement_courant_id:
            queryset = queryset.filter(etablissements=user.etablissement_courant_id)
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


class AnnonceViewSet(viewsets.ModelViewSet):
    """Annonces : les enseignants publient pour leurs classes, l'admin pour tout l'établissement."""
    queryset = Annonce.objects.select_related("auteur", "classe", "etablissement")
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
        serializer.save(auteur=user)

    def _verifier_auteur_ou_admin(self, instance):
        user = self.request.user
        if not (user.est_admin or instance.auteur_id == user.id):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Vous ne pouvez modifier ou supprimer que vos propres annonces.")

    def perform_update(self, serializer):
        self._verifier_auteur_ou_admin(serializer.instance)
        serializer.save()

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
