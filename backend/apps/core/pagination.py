"""Paginations réutilisables de l'API."""
from rest_framework.pagination import PageNumberPagination


class PaginationAjustable(PageNumberPagination):
    """25 lignes par défaut ; ?page_size= permet d'en afficher davantage (500 au maximum)."""
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 500


class PaginationListeDeReference(PaginationAjustable):
    """Listes de référence (matières...) utilisées entières dans les formulaires et menus déroulants :
    200 éléments par défaut au lieu de 25, pour ne pas en masquer une partie."""
    page_size = 200
