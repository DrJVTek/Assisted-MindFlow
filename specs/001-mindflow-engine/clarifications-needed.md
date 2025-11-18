# Points à Clarifier - MindFlow Engine

**Date**: 2025-11-17
**Référence**: Comparaison spec.md vs cahier des charges initial

## Résumé

Analyse du spec.md pour identifier les points nécessitant des décisions ou clarifications par rapport au cahier des charges initial.

---

## ✅ Points Bien Définis (Pas de clarification nécessaire)

### 1. LLM Manager
- ✅ Interface unifiée définie (FR-001, FR-002)
- ✅ Support multi-providers (Claude, OpenAI, Mistral, Groq, local)
- ✅ Paramètres de génération listés (temperature, top_p, top_k, etc.)
- ✅ Gestion des providers online/offline

### 2. Modèle de Données
- ✅ Structure Node complète avec tous les types
- ✅ Structure Group avec hiérarchie
- ✅ Structure Comment avec attachement node/edge
- ✅ Modèle de persistance (JSON)

### 3. GraphOps
- ✅ Toutes les 13 opérations définies
- ✅ Opérations avancées (MERGE_NODES, FORK_FROM, RECABLE_NODE)
- ✅ Safeguards et validations

### 4. Context Engine
- ✅ 4 stratégies de sélection définies
- ✅ 6 types de résumés définis
- ✅ Budget de tokens

### 5. Orchestrateur
- ✅ Modes d'exploration (BreadthFirst, DepthFirst, Heuristic, Temporal)
- ✅ Conditions d'arrêt (maxDepth, maxNodesPerPass, timeBudget)
- ✅ Opt-in obligatoire (désactivé par défaut)

### 6. Groupes et Projets
- ✅ Hiérarchie arbitraire
- ✅ Import/export de projets
- ✅ Noeuds stop comme points de sortie

---

## ⚠️ Points Nécessitant des Clarifications

### 1. Embeddings et Recherche Sémantique

**Cahier des charges**: Mentionne `embed(text[]) -> embeddings` dans l'interface LLM

**Spec actuel**: FR-002 liste `embed(text[])` mais **aucune exigence fonctionnelle** sur l'utilisation des embeddings

**Questions**:
1. Les embeddings sont-ils utilisés pour la recherche de nodes similaires ?
2. Doivent-ils être utilisés pour améliorer la sélection de contexte ?
3. Sont-ils persistés avec les nodes ou calculés à la demande ?
4. Quel est le cas d'usage prioritaire pour les embeddings ?

**Recommandation**:
- **Option A**: Les embeddings sont **out of scope** pour v1.0 (future enhancement)
- **Option B**: Les embeddings sont utilisés uniquement pour la stratégie "ManualOverride" avec recherche sémantique
- **Option C**: Les embeddings sont calculés pour tous les nodes et utilisés dans HybridSummary pour améliorer la pertinence

**Décision suggérée**: Option A - Marquer comme "future enhancement" dans le scope, focus sur les 4 stratégies de contexte existantes pour v1.0

---

### 2. Format JSON Détaillé pour graph_actions

**Cahier des charges**: Spécifie le format général
```json
{
  "reply": "...",
  "graph_actions": [
    { "op": "CREATE_NODE", "type": "...", "content": "...", ... }
  ]
}
```

**Spec actuel**: FR-031 mentionne le format mais **pas de schéma JSON complet** avec tous les paramètres optionnels/requis

**Questions**:
1. Quels sont les paramètres requis vs optionnels pour chaque opération ?
2. Comment gérer les erreurs de validation dans graph_actions ?
3. Y a-t-il un ordre d'exécution si plusieurs actions ?
4. Comment gérer les dépendances entre actions (ex: créer node puis le linker) ?

**Recommandation**:
Ajouter une section "Graph Actions Execution Semantics" dans le spec:
- Ordre d'exécution: séquentiel (ordre du tableau)
- Validation: chaque action validée avant exécution
- Rollback: si une action échoue, rollback de toutes les actions précédentes (transaction)
- Références temporaires: permettre `"$created[0]"` pour référencer un node créé dans la même batch

**Décision suggérée**: Ajouter FR-032bis détaillant la sémantique transactionnelle des graph_actions

---

### 3. Mode "Review" pour les Opérations AI (Constitutional Requirement)

**Constitution**: "Users MUST be able to review AI-suggested operations before execution (optional review mode)"

**Spec actuel**: FR-032 dit "execute graph_actions automatically" mais **ne mentionne pas** le mode review optionnel

**Questions**:
1. Le mode review est-il global (pour tous les users) ou par session ?
2. Comment l'utilisateur active/désactive le mode review ?
3. Quelle est l'interface de review (approuver tout, approuver individuellement, modifier avant exécution) ?
4. Que se passe-t-il si l'utilisateur rejette certaines actions ?

**Recommandation**:
Ajouter FR-032bis, FR-032ter:
- **FR-032bis**: System MUST support optional review mode where graph_actions require user approval before execution
- **FR-032ter**: In review mode, users can approve, reject, or modify individual graph_actions before execution
- **FR-032quater**: Review mode is configurable per session (not persistent)

**Décision suggérée**: Ajouter ces 3 exigences au spec avec interface de review à définir dans UI (out of scope pour engine)

---

### 4. Valeurs par Défaut des Paramètres LLM

**Cahier des charges**: Liste les paramètres (temperature, top_p, top_k, etc.) mais **pas de valeurs par défaut**

**Spec actuel**: FR-003 liste les paramètres mais pas les defaults

**Questions**:
1. Quelle température par défaut ? (0.7 mentionné dans research.md et config.example.json, mais pas dans spec)
2. Quels sont les defaults pour top_p, top_k, penalties ?
3. Ces defaults sont-ils identiques pour tous les providers ou spécifiques ?

**Recommandation**:
Ajouter une section "Default Generation Parameters" dans les Assumptions:
```markdown
## Default Generation Parameters

Standard defaults (overridable per provider):
- **temperature**: 0.7 (balance between creativity and coherence)
- **top_p**: 1.0 (no nucleus sampling by default)
- **top_k**: 0 (disabled by default)
- **max_tokens**: 4096
- **timeout**: 30 seconds
- **retries**: 3 attempts
```

**Décision suggérée**: Documenter les defaults dans config.example.json ET dans une nouvelle section du spec

---

### 5. Calcul du Score de Confiance pour l'Orchestrateur

**Cahier des charges**: Mentionne "confiance minimale (score ou statut 'valid')"

**Spec actuel**: FR-041 mentionne "minimum confidence threshold" mais **ne définit pas** comment la confiance est calculée

**Questions**:
1. La confiance est-elle un score 0-1 ou juste le statut valid/invalid ?
2. Si c'est un score, qui le calcule (AI, système, utilisateur) ?
3. Comment une hypothèse obtient-elle un score de confiance ?
4. Le score est-il basé sur le contenu de l'evaluation node ou sur un champ meta.confidence ?

**Recommandation**:
Clarifier dans FR-041:
- **Option A**: Confiance = statut du node (valid/invalid/experimental), seuil binaire
- **Option B**: Confiance = meta.importance du node d'évaluation (0-1), seuil numérique (ex: 0.6)
- **Option C**: Confiance = score calculé par l'AI et retourné dans graph_actions

**Décision suggérée**: Option A pour v1.0 (plus simple), Option B pour v2.0
- Mettre à jour FR-041: "minimum confidence threshold based on evaluation node status (valid/invalid)"

---

### 6. Gestion des Erreurs d'Import de Projet

**Cahier des charges**: "Lors de la réutilisation d'un projet comme groupe [...] nodes stop sont les points d'entrée"

**Spec actuel**: FR-046 dit "generate new UUIDs" mais **ne précise pas**:

**Questions**:
1. Que se passe-t-il si le projet importé a des références externes (nodes qui référencent des nodes hors du projet) ?
2. Comment gérer les conflits de labels de groupes (2 projets avec même nom de subgroup) ?
3. Les commentaires sont-ils importés avec le projet ?
4. Les metadata (couleurs, tags, etc.) sont-elles préservées ou réinitialisées ?

**Recommandation**:
Ajouter FR-046bis, FR-046ter:
- **FR-046bis**: When importing project, external node references MUST be removed or marked as broken links
- **FR-046ter**: All metadata (colors, tags, pinned nodes) MUST be preserved during import
- **FR-046quater**: Comments attached to imported nodes MUST be included in the import

**Décision suggérée**: Ajouter ces exigences au spec + section Edge Cases

---

### 7. Limites de Profondeur et Performance

**Spec actuel**:
- SC-008 mentionne "100+ nodes and 200+ edges without UI lag"
- Edge cases mentionne "10+ levels" de groupes avec warning

**Questions**:
1. Quelle est la limite maximale recommandée de profondeur de groupes ?
2. Quelle est la limite maximale de profondeur de graph (longest path root→leaf) ?
3. Y a-t-il une limite sur le nombre de parents/enfants par node ?
4. Combien de comments maximum par node avant dégradation ?

**Recommandation**:
Ajouter une section "Performance Limits and Recommendations" dans Constraints:
```markdown
## Performance Limits

### Recommended Limits (optimal performance)
- Graph size: 10-200 nodes
- Group nesting depth: ≤5 levels
- Node parents/children: ≤20 per node
- Comments per node: ≤50

### Hard Limits (system will warn)
- Graph size: 1000 nodes
- Group nesting depth: 20 levels
- Node parents/children: 100 per node
- Comments per node: 200

### Performance Degradation Expected Beyond
- Graphs with 1000+ nodes
- Circular reference checks: O(V+E) complexity
- Context building: May exceed token budgets
```

**Décision suggérée**: Documenter ces limites dans Constraints avec avertissements appropriés

---

### 8. Comportement de PathSummary et ses Variants

**Spec actuel**: FR-025 liste "PathSummary" mais **ne définit pas** le comportement exact

**Questions**:
1. PathSummary inclut-il tous les chemins du root au focus node, ou seulement le plus court ?
2. Si plusieurs roots, comment sont-ils gérés ?
3. Les siblings le long du chemin sont-ils inclus ?
4. Comment gérer les nodes avec importance=0 le long du path ?

**Recommandation**:
Ajouter une définition détaillée de PathSummary dans data-model.md ou créer un annexe:
```markdown
### PathSummary Behavior

1. **Path Selection**: For focus node with multiple paths to roots, select path with highest average importance
2. **Siblings**: Exclude siblings (only direct ancestors in path)
3. **Importance Weighting**: Nodes with importance <0.3 are summarized, ≥0.3 included fully
4. **Multiple Roots**: If multiple roots, select path with most recent root creation
```

**Décision suggérée**: Documenter tous les types de summary avec comportements précis dans contracts/context-engine.json

---

### 9. Types de Nodes "group_meta" et "comment"

**Spec actuel**: FR-006 liste les types de nodes incluant "group_meta" et "comment"

**Questions**:
1. À quoi sert le type "group_meta" ? (Le modèle a déjà Group.meta)
2. À quoi sert le type "comment" ? (Le modèle a déjà Comment entity)
3. Ces types sont-ils legacy ou ont-ils un usage spécifique ?
4. Peuvent-ils être supprimés pour simplifier ?

**Recommandation**:
- **Option A**: Supprimer "group_meta" et "comment" des types de Node (redondant avec Group.meta et Comment entity)
- **Option B**: Documenter explicitement leur usage:
  - "group_meta": Node contenant des métadonnées sur un groupe entier (description longue, notes)
  - "comment": Node de type commentaire (alternatif à Comment entity pour compatibilité)

**Décision suggérée**: Option A - Simplifier en supprimant ces types redondants, mettre à jour FR-006

---

### 10. Stratégie par Défaut et Fallbacks

**Spec actuel**: Définit 4 stratégies de contexte et 6 types de résumés mais **ne précise pas**:

**Questions**:
1. Quelle est la stratégie par défaut si l'utilisateur n'en spécifie pas ?
2. Quel est le type de résumé par défaut ?
3. Que se passe-t-il si la stratégie sélectionnée ne trouve aucun node (ex: GraphNeighborhood sur un orphan) ?
4. Y a-t-il un fallback automatique vers une autre stratégie ?

**Recommandation**:
Ajouter dans les Assumptions:
```markdown
## Context Engine Defaults and Fallbacks

**Default Strategy**: GraphNeighborhood (most relevant for typical use cases)
**Default Summary Type**: HybridSummary (optimal balance)
**Fallback Behavior**:
- If GraphNeighborhood finds no nodes → fallback to Timeline (all nodes chronological)
- If GroupContext finds no group → fallback to GraphNeighborhood
- If ManualOverride has empty node list → error (user must provide nodes)
```

**Décision suggérée**: Documenter defaults et fallbacks dans Assumptions + config.example.json

---

## 📋 Résumé des Décisions Recommandées

### Priorité Haute (Blocking pour implémentation)

1. **✅ DÉCIDER**: Embeddings scope - **Recommandation: Out of scope v1.0**
2. **✅ AJOUTER**: FR-032bis sur sémantique transactionnelle des graph_actions
3. **✅ AJOUTER**: FR-032bis-quater sur le mode review optionnel
4. **✅ DOCUMENTER**: Defaults des paramètres LLM dans spec + config
5. **✅ CLARIFIER**: Calcul de confiance orchestrateur - **Recommandation: Statut binaire v1.0**

### Priorité Moyenne (Peut être décidé pendant implémentation)

6. **✅ AJOUTER**: FR-046bis-quater sur import de projet (références externes, metadata)
7. **✅ DOCUMENTER**: Limites de performance dans Constraints
8. **✅ DÉFINIR**: Comportement détaillé de PathSummary et autres summaries
9. **✅ SIMPLIFIER**: Supprimer types de nodes redondants (group_meta, comment)

### Priorité Basse (Documentation)

10. **✅ DOCUMENTER**: Stratégies et résumés par défaut + fallbacks

---

## Actions Immédiates

### Pour l'équipe de spécification
1. Réviser spec.md et ajouter les FR manquants (FR-032bis à FR-046quater)
2. Créer une annexe "Detailed Behavior Specifications" pour les summaries
3. Mettre à jour config.example.json avec tous les defaults documentés
4. Ajouter section "Performance Limits" dans Constraints

### Pour l'équipe de développement
1. Implémenter les graph_actions avec sémantique transactionnelle (rollback complet)
2. Créer interface de review mode (même si pas utilisée en v1.0)
3. Utiliser les defaults documentés pour tous les paramètres
4. Implémenter fallbacks pour les stratégies de contexte

### Pour la validation
1. Tester les edge cases d'import de projet
2. Valider les limites de performance avec graphs de 100, 500, 1000 nodes
3. Vérifier comportement des fallbacks
4. Tester mode review avec différents scénarios

---

**Statut**: ⚠️ **10 points nécessitent clarification avant finalisation du spec**

**Prochaine étape**: Décider pour chaque point et mettre à jour spec.md v2.0
