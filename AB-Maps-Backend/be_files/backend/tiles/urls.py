"""
URLs for the tiles app.
"""
from django.urls import path
from .views import tile_mvt
from .admin_tiles import fylke_tile, kommune_tile, grunnkrets_tile

urlpatterns = [
    # Existing address/building tiles
    path("tiles/<int:z>/<int:x>/<int:y>.pbf", tile_mvt, name="tile_mvt"),
    
    # Admin boundary tiles
    path("tiles/fylke/<int:z>/<int:x>/<int:y>.mvt", fylke_tile, name="fylke_tile"),
    path("tiles/kommune/<int:z>/<int:x>/<int:y>.mvt", kommune_tile, name="kommune_tile"),
    path("tiles/grunnkrets/<int:z>/<int:x>/<int:y>.mvt", grunnkrets_tile, name="grunnkrets_tile"),
    
    # Versioned grunnkrets tiles (for cache busting by year)
    path("tiles/grunnkrets/v<int:year>/<int:z>/<int:x>/<int:y>.mvt", 
         grunnkrets_tile, name="grunnkrets_tile_versioned"),
]
