"""
Neo4j graph service. Stores city graph for advanced relationship queries.
Falls back gracefully if Neo4j is unavailable.
"""

import os
from typing import Optional

NEO4J_URI      = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER     = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "codecity123")

try:
    from neo4j import GraphDatabase
    _driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    _driver.verify_connectivity()
    NEO4J_AVAILABLE = True
    print(f"[neo4j] Connected at {NEO4J_URI}")
except Exception as e:
    print(f"[neo4j] Unavailable ({e}), skipping graph storage")
    NEO4J_AVAILABLE = False
    _driver = None


def store_city_graph(repo_url: str, buildings: list, roads: list) -> bool:
    """Store the city as a property graph in Neo4j."""
    if not NEO4J_AVAILABLE:
        return False
    
    try:
        with _driver.session() as session:
            # Clear existing data for this repo
            session.run(
                "MATCH (n:File {repo: $repo}) DETACH DELETE n",
                repo=repo_url
            )
            
            # Create File nodes
            for b in buildings:
                meta = b.get("metadata", {})
                session.run("""
                    CREATE (f:File {
                        id:            $id,
                        repo:          $repo,
                        file_path:     $file_path,
                        language:      $language,
                        loc:           $loc,
                        complexity:    $complexity,
                        is_hotspot:    $is_hotspot,
                        ai_summary:    $ai_summary,
                        district:      $district
                    })
                """, {
                    "id":         b["id"],
                    "repo":       repo_url,
                    "file_path":  b["file_path"],
                    "language":   meta.get("language", ""),
                    "loc":        meta.get("loc", 0),
                    "complexity": meta.get("complexity", 0.0),
                    "is_hotspot": meta.get("is_hotspot", False),
                    "ai_summary": meta.get("ai_summary", "")[:200],
                    "district":   b.get("district", ""),
                })
            
            # Create IMPORTS relationships
            for road in roads:
                session.run("""
                    MATCH (a:File {id: $src, repo: $repo})
                    MATCH (b:File {id: $dst, repo: $repo})
                    CREATE (a)-[:IMPORTS {cross_district: $cross}]->(b)
                """, {
                    "src":   road["start_building_id"],
                    "dst":   road["end_building_id"],
                    "repo":  repo_url,
                    "cross": road.get("cross_district", False),
                })
        
        print(f"[neo4j] Stored {len(buildings)} nodes, {len(roads)} edges for {repo_url}")
        return True
    
    except Exception as e:
        print(f"[neo4j] Store error: {e}")
        return False


def query_dependencies(repo_url: str, file_id: str, depth: int = 2) -> list:
    """Find all files that a given file depends on, up to N hops."""
    if not NEO4J_AVAILABLE:
        return []
    
    try:
        with _driver.session() as session:
            result = session.run("""
                MATCH path = (start:File {id: $id, repo: $repo})-[:IMPORTS*1..$depth]->(dep:File)
                RETURN DISTINCT dep.file_path as file_path, dep.complexity as complexity,
                       length(path) as hops
                ORDER BY hops, complexity DESC
            """, {"id": file_id, "repo": repo_url, "depth": depth})
            return [dict(r) for r in result]
    except Exception:
        return []


def get_graph_stats(repo_url: str) -> dict:
    """Get graph statistics for the API."""
    if not NEO4J_AVAILABLE:
        return {"available": False}
    
    try:
        with _driver.session() as session:
            stats = session.run("""
                MATCH (f:File {repo: $repo})
                OPTIONAL MATCH (f)-[r:IMPORTS]->()
                RETURN count(DISTINCT f) as nodes, count(r) as edges
            """, {"repo": repo_url}).single()
            return {
                "available": True,
                "nodes":     stats["nodes"] if stats else 0,
                "edges":     stats["edges"] if stats else 0,
            }
    except Exception:
        return {"available": True, "error": "query failed"}
