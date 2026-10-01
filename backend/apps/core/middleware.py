"""Middleware qui journalise automatiquement les requêtes d'écriture (audit trail)."""
from apps.core.models import JournalActivite

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class ActivityLogMiddleware:
    """Consigne chaque requête d'écriture authentifiée dans le journal d'activité.

    Une journalisation plus fine (par modèle, avant/après) est faite directement
    dans les vues/serializers sensibles (paiements, notes, suppression d'élève...).
    Ce middleware garantit un filet de sécurité global.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            if request.method in WRITE_METHODS and getattr(request, "user", None) and request.user.is_authenticated:
                if response.status_code < 400:
                    JournalActivite.objects.create(
                        utilisateur=request.user,
                        action=self._map_action(request.method),
                        modele=request.path,
                        description=f"{request.method} {request.path} -> {response.status_code}",
                        adresse_ip=self._get_client_ip(request),
                    )
        except Exception:
            # La journalisation ne doit jamais casser la requête principale.
            pass
        return response

    @staticmethod
    def _map_action(method):
        return {
            "POST": "create",
            "PUT": "update",
            "PATCH": "update",
            "DELETE": "delete",
        }.get(method, "other")

    @staticmethod
    def _get_client_ip(request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")
