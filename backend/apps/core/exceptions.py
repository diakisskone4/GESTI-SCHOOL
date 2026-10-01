"""Gestion centralisée des exceptions DRF : transforme les erreurs de contraintes
BDD non gérées par défaut (ProtectedError, IntegrityError) en réponses HTTP 400
propres plutôt qu'en erreur 500 pour l'utilisateur."""
from django.db import IntegrityError
from django.db.models.deletion import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is not None:
        return response

    if isinstance(exc, ProtectedError):
        objets = ", ".join(sorted({obj.__class__.__name__ for obj in exc.protected_objects}))
        return Response(
            {"detail": f"Suppression impossible : cet élément est encore utilisé par d'autres données ({objets})."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if isinstance(exc, IntegrityError):
        return Response(
            {"detail": "Opération impossible : elle viole une contrainte d'intégrité des données."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return None
