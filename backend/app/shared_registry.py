from sqlalchemy.orm import registry

# Singleton registry and metadata to avoid duplication
shared_registry = registry()
metadata = shared_registry.metadata
