"""Données : rattache chaque compte existant aux établissements dont il relève.

Avec le cloisonnement multi-établissements, un utilisateur ne voit que les données des
établissements présents dans User.etablissements. Les comptes créés auparavant n'y avaient
pas toujours leur établissement (ex. enseignants créés depuis la page Enseignants).
"""
from django.db import migrations


def rattacher(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    Employe = apps.get_model("staff", "Employe")
    Eleve = apps.get_model("students", "Eleve")
    LienParentEleve = apps.get_model("accounts", "LienParentEleve")

    for user in User.objects.all():
        ids = set()
        if user.etablissement_courant_id:
            ids.add(user.etablissement_courant_id)
        ids.update(Employe.objects.filter(user=user).values_list("etablissement_id", flat=True))
        ids.update(Eleve.objects.filter(user=user).values_list("etablissement_id", flat=True))
        ids.update(
            LienParentEleve.objects.filter(parent=user).values_list("eleve__etablissement_id", flat=True)
        )
        ids.discard(None)
        if not ids:
            continue
        user.etablissements.add(*ids)
        if not user.etablissement_courant_id:
            user.etablissement_courant_id = sorted(ids)[0]
            user.save(update_fields=["etablissement_courant"])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_initial"),
        ("staff", "0001_initial"),
        ("students", "0002_eleve_nom_mere_eleve_nom_pere"),
    ]

    operations = [migrations.RunPython(rattacher, migrations.RunPython.noop)]
