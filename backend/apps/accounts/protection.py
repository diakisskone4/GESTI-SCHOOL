"""Protection contre les attaques par force brute.

- Connexion (API et administration Django) : après CONNEXION_ECHECS_MAX mots de passe erronés pour
  une même adresse e-mail, le compte est bloqué CONNEXION_BLOCAGE_MINUTES. Le compteur porte sur
  l'adresse visée et non sur l'adresse IP : toute une école partage souvent la même connexion
  internet, et un attaquant change facilement d'IP.
- Inscription élève par matricule : le couple matricule + date de naissance ne peut pas être
  essayé indéfiniment (sinon on pourrait s'approprier le compte d'un élève en essayant les dates).
"""
from django.conf import settings
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.core.cache import cache


def _cle(prefixe, identifiant):
    return f"gs:{prefixe}:{(identifiant or '').strip().lower()[:254]}"


def _reglage(nom, defaut):
    return getattr(settings, nom, defaut)


# ---------------------------------------------------------------------------
# Connexion
# ---------------------------------------------------------------------------
def connexion_bloquee(email):
    return cache.get(_cle("echecs", email), 0) >= _reglage("CONNEXION_ECHECS_MAX", 8)


def enregistrer_echec_connexion(email):
    cle = _cle("echecs", email)
    duree = _reglage("CONNEXION_BLOCAGE_MINUTES", 15) * 60
    if cache.add(cle, 1, duree):
        return
    try:
        cache.incr(cle)
    except ValueError:  # la clé vient d'expirer
        cache.set(cle, 1, duree)


def reinitialiser_connexion(email):
    cache.delete(_cle("echecs", email))


class AuthentificationProtegee(ModelBackend):
    """Authentification par e-mail et mot de passe, refusée tant que le compte est bloqué."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        identifiant = username or kwargs.get(get_user_model().USERNAME_FIELD)
        if not identifiant or password is None:
            return None
        if connexion_bloquee(identifiant):
            return None
        user = super().authenticate(request, username=username, password=password, **kwargs)
        if user is None:
            enregistrer_echec_connexion(identifiant)
        else:
            reinitialiser_connexion(identifiant)
        return user


# ---------------------------------------------------------------------------
# Rattachement d'un compte élève à un matricule
# ---------------------------------------------------------------------------
MATRICULE_ESSAIS_MAX = 5
MATRICULE_FENETRE = 3600


def matricule_bloque(matricule):
    return cache.get(_cle("matricule", matricule), 0) >= MATRICULE_ESSAIS_MAX


def enregistrer_echec_matricule(matricule):
    cle = _cle("matricule", matricule)
    if not cache.add(cle, 1, MATRICULE_FENETRE):
        try:
            cache.incr(cle)
        except ValueError:
            cache.set(cle, 1, MATRICULE_FENETRE)
