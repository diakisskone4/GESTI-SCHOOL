"""Outils pour les migrations."""
import logging

from django.db import DatabaseError, migrations, transaction

logger = logging.getLogger(__name__)


def contrainte_tolerante(app_label, model_name, constraint):
    """Ajoute une contrainte d'unicité sans faire échouer le déploiement si des doublons existent déjà.

    L'état Django connaît toujours la contrainte. En base, elle n'est créée que si les données la
    respectent ; sinon un avertissement est affiché. Les formulaires et l'API refusent de toute
    façon les nouveaux doublons (apps/accounts/doublons.py).
    """
    def ajouter(apps, schema_editor):
        modele = apps.get_model(app_label, model_name)
        try:
            with transaction.atomic(using=schema_editor.connection.alias):
                schema_editor.add_constraint(modele, constraint)
        except DatabaseError as exc:
            logger.warning("Contrainte %s non posée (doublons existants ?) : %s", constraint.name, exc)
            print(f"\n  ! Contrainte « {constraint.name} » non posée : des doublons existent déjà en base. "
                  "Les nouveaux doublons restent refusés par l'application.")

    def retirer(apps, schema_editor):
        modele = apps.get_model(app_label, model_name)
        try:
            with transaction.atomic(using=schema_editor.connection.alias):
                schema_editor.remove_constraint(modele, constraint)
        except DatabaseError:
            pass

    return migrations.SeparateDatabaseAndState(
        state_operations=[migrations.AddConstraint(model_name=model_name, constraint=constraint)],
        database_operations=[migrations.RunPython(ajouter, retirer)],
    )
