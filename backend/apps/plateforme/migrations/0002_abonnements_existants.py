"""Données : chaque établissement déjà présent reçoit un abonnement actif de 12 mois,
pour qu'aucun client existant ne soit bloqué au déploiement de la console."""
import datetime

from django.db import migrations


def creer_abonnements(apps, schema_editor):
    from apps.plateforme.models import ajouter_mois

    Etablissement = apps.get_model("core", "Etablissement")
    Abonnement = apps.get_model("plateforme", "Abonnement")
    aujourd_hui = datetime.date.today()
    for etablissement in Etablissement.objects.filter(abonnement__isnull=True):
        Abonnement.objects.create(
            etablissement=etablissement, duree_mois=12, date_debut=aujourd_hui,
            date_fin=ajouter_mois(aujourd_hui, 12), actif=True,
            notes="Abonnement initial créé automatiquement (établissement existant avant la console).",
        )


class Migration(migrations.Migration):
    dependencies = [("plateforme", "0001_initial"), ("core", "0006_images_etablissement_en_base")]
    operations = [migrations.RunPython(creer_abonnements, migrations.RunPython.noop)]
