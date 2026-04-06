# Search Functionality Test Coverage

This document describes the comprehensive test suite for the search functionality added in this branch.

## Test Files

### 1. `src/__tests__/search.test.ts`
Tests for the core semantic search engine (`src/lib/search.ts`)

**Test Coverage:**
- ✅ Query embedding generation
- ✅ Searching across scenes, beats, and propositions
- ✅ Result limiting to SEARCH_TOP_K
- ✅ Result sorting by similarity (descending order)
- ✅ Timeline heatmap generation
- ✅ Top arc identification
- ✅ Query embedding inclusion in results
- ✅ Graceful handling of scenes without embeddings
- ✅ Graceful handling of narratives with no scenes

**Key Features Tested:**
- Embedding resolution from references
- Cosine similarity computation
- Multi-level search (scene, beat, proposition)
- Result aggregation and ranking
- Timeline visualization data generation
- Arc-level relevance scoring

### 2. `src/__tests__/search-synthesis.test.ts`
Tests for AI-powered search synthesis (`src/lib/ai/search-synthesis.ts`)

**Test Coverage:**
- ✅ AI API context building with search results
- ✅ Token streaming callback functionality
- ✅ Overview and citation generation
- ✅ Citation ID to result metadata mapping
- ✅ Long content truncation in citation titles
- ✅ Invalid citation ID filtering
- ✅ Error handling with fallback synthesis
- ✅ Invalid JSON response handling
- ✅ Missing overview/citationIds handling
- ✅ Null top arc handling
- ✅ Empty results handling
- ✅ Result type mapping (proposition, beat, scene)
- ✅ Optional onToken callback support
- ✅ Top arc inclusion in context

**Key Features Tested:**
- LLM prompt construction with search context
- Streaming response handling
- JSON parsing and validation
- Citation metadata extraction
- Fallback synthesis generation
- Robust error handling

## Test Statistics

- **Total Tests:** 23
- **Passing:** 23
- **Failing:** 0
- **Coverage:** Core search and synthesis logic

## Mocking Strategy

### Mocked Modules
1. **`@/lib/embeddings`**: Mocked to return predictable embedding vectors
2. **`@/lib/ai/api`**: Mocked to simulate LLM streaming responses
3. **`@/lib/ai/json`**: Mocked for controlled JSON parsing
4. **`@/lib/system-logger`**: Mocked to prevent console pollution

### Mock Data
- **Narrative Structure**: Complete mock with scenes, beats, propositions, arcs, characters, locations
- **Embeddings**: Deterministic vectors for reproducible similarity scores
- **LLM Responses**: Predefined JSON with overview and citations

## Running the Tests

```bash
# Run all search tests
npm run test:run -- src/__tests__/search.test.ts src/__tests__/search-synthesis.test.ts

# Run with coverage
npm run test:coverage -- src/__tests__/search.test.ts src/__tests__/search-synthesis.test.ts

# Run specific test
npm run test:run -- src/__tests__/search.test.ts -t "should generate query embedding"
```

## Integration Points Tested

1. **Search Engine → Embeddings Module**
   - Query embedding generation
   - Embedding resolution from references
   - Similarity computation

2. **Search Engine → Narrative State**
   - Scene traversal
   - Beat plan access
   - Proposition extraction

3. **Synthesis → Search Results**
   - Result context building
   - Citation mapping
   - Arc/scene metadata extraction

4. **Synthesis → AI API**
   - Prompt construction
   - Streaming response handling
   - Error recovery

## What's NOT Tested (Frontend)

As per requirements, frontend components are not tested:
- `SearchView.tsx` - React component
- User interaction flows
- UI rendering
- View mode switching
- Expandable sections
- Navigation to citations

## Edge Cases Covered

1. **Empty States**
   - No results found
   - No scenes in narrative
   - Empty timeline

2. **Missing Data**
   - Scenes without embeddings
   - Beats without centroids
   - Propositions without embeddings
   - Missing top arc/scene

3. **Error Handling**
   - API failures
   - Invalid JSON responses
   - Missing required fields
   - Invalid citation IDs

4. **Boundary Conditions**
   - Result limiting (SEARCH_TOP_K)
   - Long content truncation
   - Empty query strings

## Future Test Improvements

Potential areas for expanded coverage:
- Performance testing with large narratives (1000+ scenes)
- Concurrent search query handling
- Embedding cache behavior
- Search result pagination
- Advanced filtering (by arc, by type, by similarity threshold)
- Search query history and autocomplete
