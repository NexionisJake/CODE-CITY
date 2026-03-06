# Design Document: CodeCity

## Overview

CodeCity transforms GitHub repositories into interactive 3D cities where code metrics become visual properties. The system consists of two main components:

1. **Backend (Python FastAPI)**: Orchestrates repository analysis through a pipeline of ingestion, parsing, metrics calculation, AI enrichment, and spatial layout generation
2. **Frontend (Next.js + React Three Fiber)**: Renders the 3D city visualization with interactive exploration capabilities

The architecture follows a clear separation where the backend owns all analysis logic and 3D positioning mathematics, while the frontend focuses purely on rendering and user interaction.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ URL Input    │  │ 3D Canvas    │  │ Tooltip      │      │
│  │ Component    │  │ (R3F)        │  │ Component    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                     HTTP POST /api/build-city               │
└────────────────────────────┼────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────┐
│                         Backend                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Pipeline Orchestrator                    │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ├──► Repository Ingestion (GitHub ZIP download)     │
│         │                                                    │
│         ├──► AST Parsing (Tree-sitter: Py/JS/TS/JSX/TSX)   │
│         │                                                    │
│         ├──► Dependency Graph Extraction (Import analysis)  │
│         │                                                    │
│         ├──► Metrics Calculation (Radon: LOC/complexity)    │
│         │                                                    │
│         ├──► AI Enrichment (AWS Bedrock Claude 3 Haiku)    │
│         │                                                    │
│         └──► Spatial Layout Generation (Grid clustering)    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend:**
- Python 3.11+
- FastAPI for REST API
- Tree-sitter for multi-language AST parsing
- Radon for Python code metrics
- boto3 for AWS Bedrock integration
- asyncio for concurrent AI calls

**Frontend:**
- Next.js 14 (App Router)
- React 18
- React Three Fiber (Three.js wrapper)
- TypeScript for type safety

**Infrastructure:**
- Backend: Docker → AWS App Runner
- Frontend: AWS Amplify
- AI: AWS Bedrock (Claude 3 Haiku)

## Components and Interfaces

### Backend Components

#### 1. Repository Ingestion Module

**Responsibility:** Download and extract GitHub repositories

**Interface:**
```python
async def ingest_repository(repo_url: str) -> Path:
    """
    Downloads GitHub repository and extracts to temporary directory.
    
    Args:
        repo_url: GitHub repository URL (e.g., https://github.com/user/repo)
    
    Returns:
        Path to extracted repository root directory
    
    Raises:
        IngestionError: If download or extraction fails
    """
```

**Implementation Details:**
- Construct ZIP download URL: `{repo_url}/archive/refs/heads/{branch}.zip`
- Try `main` branch first, fallback to `master`
- Use `httpx` for async HTTP requests
- Extract to `tempfile.mkdtemp()` directory
- Skip noise directories during traversal: `{node_modules, .git, __pycache__, venv, dist, build, .next, coverage}`

#### 2. AST Parser Module

**Responsibility:** Parse source files into abstract syntax trees

**Interface:**
```python
class ASTParser:
    def __init__(self):
        self.parsers = {
            '.py': tree_sitter.Parser(tree_sitter.Language('python')),
            '.js': tree_sitter.Parser(tree_sitter.Language('javascript')),
            '.ts': tree_sitter.Parser(tree_sitter.Language('typescript')),
            '.jsx': tree_sitter.Parser(tree_sitter.Language('javascript')),
            '.tsx': tree_sitter.Parser(tree_sitter.Language('typescript')),
        }
    
    def parse_file(self, file_path: Path) -> Optional[tree_sitter.Tree]:
        """
        Parse a source file into an AST.
        
        Args:
            file_path: Path to source file
        
        Returns:
            Parsed tree or None if parsing fails
        """
```

**Implementation Details:**
- Detect file extension and select appropriate parser
- Read file content as bytes for tree-sitter
- Return parsed tree with root node
- Handle encoding errors gracefully

#### 3. Dependency Graph Extractor

**Responsibility:** Extract import relationships from AST

**Interface:**
```python
class DependencyExtractor:
    def extract_imports(self, tree: tree_sitter.Tree, file_path: Path) -> List[str]:
        """
        Extract import statements from AST.
        
        Args:
            tree: Parsed AST
            file_path: Path to source file (for relative import resolution)
        
        Returns:
            List of imported module/file paths
        """
    
    def resolve_import_path(self, import_stmt: str, source_file: Path, 
                           repo_root: Path) -> Optional[Path]:
        """
        Resolve import statement to actual file path using heuristics.
        
        Args:
            import_stmt: Import statement string
            source_file: File containing the import
            repo_root: Repository root directory
        
        Returns:
            Resolved file path or None if not found
        """
```

**Implementation Details:**
- Query AST for import nodes:
  - Python: `import_statement`, `import_from_statement`
  - JavaScript/TypeScript: `import_statement`, `call_expression` (for require)
- Extract module names from import nodes
- Heuristic resolution:
  1. Relative imports: resolve from source file directory
  2. Absolute imports: search from repo root
  3. Try adding common extensions: `.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `/index.js`, `/index.ts`
  4. Check if resolved path exists in repository
- Build directed graph: `{source_file: [imported_file1, imported_file2, ...]}`

#### 4. Metrics Calculator

**Responsibility:** Calculate code metrics for dimensional mapping

**Interface:**
```python
class MetricsCalculator:
    def calculate_metrics(self, file_path: Path, tree: tree_sitter.Tree) -> FileMetrics:
        """
        Calculate code metrics for a file.
        
        Args:
            file_path: Path to source file
            tree: Parsed AST
        
        Returns:
            FileMetrics object with LOC, complexity, function count
        """

@dataclass
class FileMetrics:
    loc: int  # Lines of code
    complexity: float  # Cyclomatic complexity
    function_count: int  # Number of functions/methods
```

**Implementation Details:**
- Use Radon for Python files:
  - `radon.raw.analyze()` for LOC
  - `radon.complexity.cc_visit()` for cyclomatic complexity (average across functions)
  - Count function definitions from complexity results
- For JavaScript/TypeScript, use AST-based fallback:
  - LOC: count non-empty, non-comment lines from file
  - Complexity: estimate from control flow nodes (if/while/for/switch/catch)
  - Function count: query AST for function_declaration, method_definition, arrow_function nodes
- Handle errors by returning default metrics: `FileMetrics(loc=0, complexity=1, function_count=0)`

#### 5. AI Enrichment Module

**Responsibility:** Generate file summaries using AWS Bedrock

**Interface:**
```python
class AIEnricher:
    def __init__(self, bedrock_client):
        self.client = bedrock_client
        self.model_id = "anthropic.claude-3-haiku-20240307-v1:0"
    
    async def enrich_files(self, files: List[Tuple[Path, str]], 
                          max_files: int = 15) -> Dict[Path, str]:
        """
        Generate AI summaries for files concurrently.
        
        Args:
            files: List of (file_path, file_content) tuples
            max_files: Maximum number of files to enrich
        
        Returns:
            Dictionary mapping file paths to AI summaries
        """
    
    async def _generate_summary(self, file_path: Path, content: str) -> str:
        """Generate summary for a single file."""
```

**Implementation Details:**
- Select top N files by LOC (up to max_files=15)
- Use `asyncio.gather()` to invoke Bedrock concurrently for all selected files
- Prompt template:
  ```
  Analyze this source code file and provide a concise 2-3 sentence summary.
  
  File: {file_path}
  
  Code:
  {content}
  
  Summary:
  ```
- Parse response to extract summary text
- Handle failures gracefully: return empty string and log warning
- Require IAM role with `bedrock:InvokeModel` permission

#### 6. Spatial Layout Generator

**Responsibility:** Generate 3D positions for buildings with directory clustering

**Interface:**
```python
class SpatialLayoutGenerator:
    def generate_layout(self, files: List[Path], repo_root: Path, 
                       metrics: Dict[Path, FileMetrics]) -> Dict[Path, Position]:
        """
        Generate 3D positions for files with directory clustering.
        
        Args:
            files: List of file paths
            repo_root: Repository root directory
            metrics: File metrics for height calculation
        
        Returns:
            Dictionary mapping file paths to 3D positions
        """

@dataclass
class Position:
    x: float
    y: float  # Always height / 2 to anchor on ground
    z: float
```

**Implementation Details:**
- Group files by parent directory
- Assign each directory cluster a grid region
- Within each cluster, arrange files in a grid pattern
- Grid spacing: 10 units between buildings
- Calculate y-coordinate: `y = (loc / LOC_SCALE_FACTOR) / 2` where `LOC_SCALE_FACTOR = 10`
- Ensure no overlaps by maintaining minimum spacing
- Center the entire layout around origin (0, 0, 0)

#### 7. API Endpoint Handler

**Responsibility:** Orchestrate the full pipeline and return city data

**Interface:**
```python
@app.post("/api/build-city")
async def build_city(request: BuildCityRequest) -> BuildCityResponse:
    """
    Orchestrate full pipeline to build city from GitHub repository.
    
    Args:
        request: Contains repository_url
    
    Returns:
        BuildCityResponse with buildings, roads, warnings, and optional error
    """

class BuildCityRequest(BaseModel):
    repository_url: str

class BuildCityResponse(BaseModel):
    repository: RepositoryInfo
    buildings: List[Building]
    roads: List[Road]
    warnings: List[str]
    error: Optional[str] = None

@dataclass
class Building:
    id: str  # Unique identifier (file path hash)
    file_path: str
    position: Dict[str, float]  # {x, y, z}
    dimensions: Dict[str, float]  # {width, height, depth}
    color: Dict[str, float]  # {r, g, b} normalized 0-1
    metadata: BuildingMetadata

@dataclass
class BuildingMetadata:
    loc: int
    complexity: float
    function_count: int
    ai_summary: Optional[str]

@dataclass
class Road:
    start_building_id: str
    end_building_id: str
    directed: bool  # Always True for imports
```

**Implementation Details:**
- Pipeline execution order:
  1. Ingest repository
  2. Parse all supported files
  3. Extract dependency graph
  4. Calculate metrics
  5. Generate AI summaries (concurrent)
  6. Generate spatial layout
  7. Build response objects
- Collect warnings throughout pipeline
- Map metrics to dimensions:
  - Height: `loc / 10`
  - Width/Depth: `sqrt(function_count) * 2` (minimum 2)
- Map complexity to color:
  - ≤5: Green `{r: 0.2, g: 0.8, b: 0.2}`
  - 5-10: Yellow `{r: 0.9, g: 0.9, b: 0.2}`
  - >10: Red `{r: 0.9, g: 0.2, b: 0.2}`
- Generate building IDs using hash of file path
- Enable CORS for frontend origin

### Frontend Components

#### 1. URL Input Component

**Responsibility:** Accept GitHub repository URL from user

**Interface:**
```typescript
interface URLInputProps {
  onSubmit: (url: string) => void;
  loading: boolean;
}

export function URLInput({ onSubmit, loading }: URLInputProps): JSX.Element
```

**Implementation Details:**
- Text input field with validation for GitHub URL format
- Submit button (disabled during loading)
- Display loading spinner when request is in flight
- Show error message if URL is invalid

#### 2. City Canvas Component

**Responsibility:** Render 3D city using React Three Fiber

**Interface:**
```typescript
interface CityCanvasProps {
  cityData: BuildCityResponse | null;
  onBuildingClick: (building: Building) => void;
}

export function CityCanvas({ cityData, onBuildingClick }: CityCanvasProps): JSX.Element
```

**Implementation Details:**
- Full-screen Canvas component from @react-three/fiber
- Camera setup: perspective camera at position (50, 50, 50) looking at origin
- OrbitControls for user navigation
- Ambient light + directional light for visibility
- Ground grid helper (100x100 units)
- Render Building components for each building in cityData
- Render Road components for each road in cityData

#### 3. Building Component

**Responsibility:** Render individual building mesh

**Interface:**
```typescript
interface BuildingProps {
  building: Building;
  onClick: () => void;
}

export function Building({ building, onClick }: BuildingProps): JSX.Element
```

**Implementation Details:**
- BoxGeometry with dimensions from building data
- MeshStandardMaterial with color from building data
- Position from building.position
- onClick handler for tooltip display
- Hover effect: slight scale increase on pointer over

#### 4. Road Component

**Responsibility:** Render import relationship as directed line

**Interface:**
```typescript
interface RoadProps {
  road: Road;
  buildings: Map<string, Building>;
}

export function Road({ road, buildings }: RoadProps): JSX.Element
```

**Implementation Details:**
- Line geometry connecting start and end building positions
- LineBasicMaterial with cyan color and opacity 0.6
- Arrow helper at end position to show direction
- Glow effect using bloom post-processing

#### 5. Tooltip Component

**Responsibility:** Display building metadata on click

**Interface:**
```typescript
interface TooltipProps {
  building: Building | null;
  onClose: () => void;
}

export function Tooltip({ building, onClose }: TooltipProps): JSX.Element
```

**Implementation Details:**
- Overlay positioned at screen coordinates
- Display file path, LOC, complexity, function count
- Display AI summary if available
- Close button and click-outside-to-close behavior
- Styled with semi-transparent background

#### 6. Main Page Component

**Responsibility:** Orchestrate frontend components and API communication

**Interface:**
```typescript
export default function Home(): JSX.Element
```

**Implementation Details:**
- State management for city data, selected building, loading, errors
- API call to backend POST /api/build-city
- Error handling and display
- Compose URLInput, CityCanvas, and Tooltip components
- Environment variable for API URL: `process.env.NEXT_PUBLIC_API_URL`

## Data Models

### Backend Models

```python
# File representation
@dataclass
class SourceFile:
    path: Path
    content: str
    tree: Optional[tree_sitter.Tree]
    metrics: FileMetrics
    imports: List[Path]

# Metrics
@dataclass
class FileMetrics:
    loc: int
    complexity: float
    function_count: int

# Position
@dataclass
class Position:
    x: float
    y: float
    z: float

# API Response Models (Pydantic)
class BuildingMetadata(BaseModel):
    loc: int
    complexity: float
    function_count: int
    ai_summary: Optional[str] = None

class Building(BaseModel):
    id: str
    file_path: str
    position: Dict[str, float]
    dimensions: Dict[str, float]
    color: Dict[str, float]
    metadata: BuildingMetadata

class Road(BaseModel):
    start_building_id: str
    end_building_id: str
    directed: bool

class RepositoryInfo(BaseModel):
    name: str

class BuildCityResponse(BaseModel):
    repository: RepositoryInfo
    buildings: List[Building]
    roads: List[Road]
    warnings: List[str]
    error: Optional[str] = None
```

### Frontend Models

```typescript
// API Response types
interface BuildCityResponse {
  repository: {
    name: string;
  };
  buildings: Building[];
  roads: Road[];
  warnings: string[];
  error: string | null;
}

interface Building {
  id: string;
  file_path: string;
  position: { x: number; y: number; z: number };
  dimensions: { width: number; height: number; depth: number };
  color: { r: number; g: number; b: number };
  metadata: {
    loc: number;
    complexity: number;
    function_count: number;
    ai_summary?: string;
  };
}

interface Road {
  start_building_id: string;
  end_building_id: string;
  directed: boolean;
}
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Backend Properties

**Property 1: Repository download and extraction**
*For any* valid GitHub repository URL, downloading and extracting the repository should produce a directory containing the repository files.
**Validates: Requirements 1.1, 1.3**

**Property 2: Branch fallback behavior**
*For any* repository without a main branch, the system should attempt to download from the master branch.
**Validates: Requirements 1.2**

**Property 3: Invalid URL error handling**
*For any* invalid or inaccessible GitHub URL, the system should return a descriptive error message without crashing.
**Validates: Requirements 1.4**

**Property 4: Noise directory filtering**
*For any* repository containing noise directories (node_modules, .git, __pycache__, venv, dist, build), those directories should be excluded from file processing.
**Validates: Requirements 1.5**

**Property 5: Multi-language AST parsing**
*For any* valid source file in supported languages (Python, JavaScript, TypeScript, JSX, TSX), parsing should produce a complete AST with a root node.
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.7**

**Property 6: Parse error resilience**
*For any* file that cannot be parsed, the system should add a warning to the warnings array and continue processing other files without failing.
**Validates: Requirements 2.6, 13.1**

**Property 7: Import extraction completeness**
*For any* source file in supported languages, all import statements (including from-imports, direct imports, ES6 imports, and require statements) should be extracted from the AST.
**Validates: Requirements 3.1, 3.2**

**Property 8: Dependency graph edge creation**
*For any* import statement that references another file in the repository, a directed edge should be created in the dependency graph from the importing file to the imported file.
**Validates: Requirements 3.3, 3.6**

**Property 9: Import path resolution**
*For any* import statement with relative or absolute paths, the heuristic matching algorithm should resolve it to the actual file path when the file exists in the repository.
**Validates: Requirements 3.4**

**Property 10: External import filtering**
*For any* import that cannot be resolved to a file in the repository, it should be skipped without adding an edge to the dependency graph.
**Validates: Requirements 3.5**

**Property 11: Comprehensive metrics calculation**
*For any* source file, metrics calculation should produce LOC, cyclomatic complexity, and function count values.
**Validates: Requirements 4.1, 4.2, 4.3**

**Property 12: LOC to height mapping**
*For any* file with calculated LOC, the building height should equal LOC divided by the scaling factor (10).
**Validates: Requirements 4.4**

**Property 13: Function count to dimensions mapping**
*For any* file with calculated function count, the building width and depth should be derived from the square root of function count.
**Validates: Requirements 4.5**

**Property 14: Complexity to color mapping**
*For any* file with calculated complexity, the building color should be green for complexity ≤5, yellow for complexity 5-10, and red for complexity >10.
**Validates: Requirements 4.6**

**Property 15: Metrics fallback on error**
*For any* file where Radon cannot calculate metrics, fallback metrics based on file size and AST node count should be used, and a warning should be added.
**Validates: Requirements 4.7, 13.3**

**Property 16: AI enrichment file cap**
*For any* repository, at most 15 files should be selected for AI enrichment regardless of repository size.
**Validates: Requirements 5.1**

**Property 17: AI enrichment prompt structure**
*For any* file selected for AI enrichment, the Bedrock prompt should include both the file path and file content.
**Validates: Requirements 5.3, 5.4**

**Property 18: AI summary attachment**
*For any* successful Bedrock call, the returned summary should be attached to the corresponding building's metadata.
**Validates: Requirements 5.5**

**Property 19: AI enrichment error resilience**
*For any* failed Bedrock call, a warning should be added to the warnings array and processing should continue for other files.
**Validates: Requirements 5.6, 13.2**

**Property 20: Position generation completeness**
*For any* set of files in a repository, the spatial layout generator should produce a 3D position {x, y, z} for every file.
**Validates: Requirements 6.1, 6.6**

**Property 21: Directory clustering**
*For any* two files in the same directory, their positions should be spatially closer than files from different directories.
**Validates: Requirements 6.2**

**Property 22: Ground anchoring**
*For any* building with calculated height, the y-coordinate should equal height divided by 2 to anchor the building on the ground plane.
**Validates: Requirements 6.3**

**Property 23: No building overlap**
*For any* two buildings in the layout, their bounding boxes should not overlap (minimum spacing maintained).
**Validates: Requirements 6.4**

**Property 24: Grid-based positioning**
*For any* set of buildings within a directory cluster, their x and z coordinates should follow a grid pattern with consistent spacing.
**Validates: Requirements 6.5**

**Property 25: Successful pipeline response structure**
*For any* successful pipeline execution, the API response should contain repository name, buildings array, roads array, and warnings array.
**Validates: Requirements 7.4**

**Property 26: Failed pipeline error response**
*For any* pipeline execution that encounters a critical error, the API response should contain an error field with a descriptive message.
**Validates: Requirements 7.5, 13.5**

**Property 27: Partial results with warnings**
*For any* pipeline execution with non-critical errors, the system should return partial results with populated warnings array rather than failing completely.
**Validates: Requirements 13.4**

### Frontend Properties

**Property 28: API request on URL submission**
*For any* repository URL submitted by the user, the frontend should send a POST request to /api/build-city with the URL in the request body.
**Validates: Requirements 8.2**

**Property 29: Building mesh rendering**
*For any* building in the API response, a BoxGeometry mesh should be rendered with dimensions and color matching the response data.
**Validates: Requirements 8.4, 9.1, 9.2, 9.3**

**Property 30: Road line rendering**
*For any* road in the API response, a line geometry should be rendered connecting the start and end building positions.
**Validates: Requirements 8.5, 10.1**

**Property 31: Directed road indicators**
*For any* road with directed flag set to true, a visual direction indicator (arrow) should be rendered showing the import direction.
**Validates: Requirements 10.2, 10.3**

**Property 32: Road endpoint positioning**
*For any* road connecting two buildings, the line should connect the center positions of both buildings regardless of their heights.
**Validates: Requirements 10.6**

**Property 33: Building click tooltip display**
*For any* building clicked by the user, a tooltip should be displayed containing the building's metadata.
**Validates: Requirements 8.8, 11.1**

**Property 34: Tooltip content completeness**
*For any* displayed tooltip, it should include file path, LOC, cyclomatic complexity, function count, and AI summary (when available).
**Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6**

**Property 35: Tooltip closing behavior**
*For any* open tooltip, clicking outside the tooltip or on another building should close the current tooltip.
**Validates: Requirements 11.7**

**Property 36: Error message display**
*For any* API response containing an error field, the frontend should display the error message to the user.
**Validates: Requirements 8.10**

## Error Handling

### Backend Error Handling

**Non-Critical Errors (Warnings):**
- File parsing failures: Add warning, continue with other files
- AI enrichment failures: Add warning, continue with other files
- Metrics calculation failures: Use fallback values, add warning, continue
- Import resolution failures: Skip unresolved imports, continue

**Critical Errors (Fail Fast):**
- Invalid repository URL: Return error response immediately
- Repository download failure: Return error response
- Complete parsing failure (no files parsed): Return error response
- Spatial layout generation failure: Return error response

**Error Response Format:**
```json
{
  "repository": null,
  "buildings": [],
  "roads": [],
  "warnings": [],
  "error": "Descriptive error message with actionable guidance"
}
```

**Warning Format:**
```json
{
  "repository": {"name": "repo-name"},
  "buildings": [...],
  "roads": [...],
  "warnings": [
    "Failed to parse file src/broken.py: SyntaxError",
    "AI enrichment failed for src/large.js: Timeout",
    "Metrics calculation failed for src/weird.ts: Using fallback"
  ],
  "error": null
}
```

### Frontend Error Handling

**Network Errors:**
- Display: "Failed to connect to backend. Please check your connection."
- Retry button available

**Backend Errors:**
- Display error message from response.error field
- Provide actionable guidance (e.g., "Check repository URL format")

**Warnings:**
- Display warning count in non-intrusive banner
- Expandable list to view all warnings
- Don't block visualization

**Loading States:**
- Show spinner during API call
- Display progress message: "Building your city..."
- Disable submit button during loading

## Testing Strategy

### Dual Testing Approach

CodeCity will use both unit tests and property-based tests to ensure comprehensive correctness:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs using randomized testing

Both testing approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Backend Testing

**Property-Based Testing Library:** Hypothesis (Python)

**Configuration:**
- Minimum 100 iterations per property test
- Each test tagged with: `# Feature: codecity, Property N: [property text]`
- Each correctness property implemented as a single property-based test

**Test Organization:**
```
backend/
  tests/
    test_ingestion.py          # Properties 1-4
    test_parsing.py            # Properties 5-6
    test_dependencies.py       # Properties 7-10
    test_metrics.py            # Properties 11-15
    test_ai_enrichment.py      # Properties 16-19
    test_spatial_layout.py     # Properties 20-24
    test_api.py                # Properties 25-27
    test_error_handling.py     # Error handling scenarios
```

**Property Test Examples:**

```python
from hypothesis import given, strategies as st
import hypothesis

# Feature: codecity, Property 5: Multi-language AST parsing
@given(st.sampled_from(['.py', '.js', '.ts', '.jsx', '.tsx']))
@hypothesis.settings(max_examples=100)
def test_multi_language_parsing(file_extension):
    """For any valid source file in supported languages, parsing should produce a complete AST."""
    parser = ASTParser()
    valid_code = generate_valid_code(file_extension)
    tree = parser.parse_file(valid_code, file_extension)
    assert tree is not None
    assert tree.root_node is not None

# Feature: codecity, Property 14: Complexity to color mapping
@given(st.floats(min_value=0, max_value=50))
@hypothesis.settings(max_examples=100)
def test_complexity_color_mapping(complexity):
    """For any calculated complexity, color should match the defined ranges."""
    color = map_complexity_to_color(complexity)
    if complexity <= 5:
        assert color == {'r': 0.2, 'g': 0.8, 'b': 0.2}  # Green
    elif complexity <= 10:
        assert color == {'r': 0.9, 'g': 0.9, 'b': 0.2}  # Yellow
    else:
        assert color == {'r': 0.9, 'g': 0.2, 'b': 0.2}  # Red
```

**Unit Test Focus:**
- Specific repository examples (e.g., test with a known small repo)
- Edge cases: empty repositories, single-file repositories
- Error conditions: network failures, invalid responses
- Integration: full pipeline with mocked external dependencies

### Frontend Testing

**Property-Based Testing Library:** fast-check (TypeScript/JavaScript)

**Configuration:**
- Minimum 100 iterations per property test
- Each test tagged with: `// Feature: codecity, Property N: [property text]`

**Test Organization:**
```
frontend/
  __tests__/
    components/
      URLInput.test.tsx
      CityCanvas.test.tsx
      Building.test.tsx
      Road.test.tsx
      Tooltip.test.tsx
    integration/
      city-rendering.test.tsx   # Properties 28-36
```

**Property Test Examples:**

```typescript
import fc from 'fast-check';

// Feature: codecity, Property 29: Building mesh rendering
test('building dimensions match API response data', () => {
  fc.assert(
    fc.property(
      fc.record({
        width: fc.float({ min: 1, max: 20 }),
        height: fc.float({ min: 1, max: 100 }),
        depth: fc.float({ min: 1, max: 20 }),
      }),
      (dimensions) => {
        const building = createBuilding({ dimensions });
        const mesh = render(<Building building={building} />);
        expect(mesh.geometry.parameters.width).toBe(dimensions.width);
        expect(mesh.geometry.parameters.height).toBe(dimensions.height);
        expect(mesh.geometry.parameters.depth).toBe(dimensions.depth);
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: codecity, Property 34: Tooltip content completeness
test('tooltip contains all required metadata', () => {
  fc.assert(
    fc.property(
      fc.record({
        file_path: fc.string(),
        loc: fc.integer({ min: 0 }),
        complexity: fc.float({ min: 0 }),
        function_count: fc.integer({ min: 0 }),
        ai_summary: fc.option(fc.string()),
      }),
      (metadata) => {
        const { container } = render(<Tooltip building={{ metadata }} />);
        expect(container).toHaveTextContent(metadata.file_path);
        expect(container).toHaveTextContent(metadata.loc.toString());
        expect(container).toHaveTextContent(metadata.complexity.toString());
        expect(container).toHaveTextContent(metadata.function_count.toString());
        if (metadata.ai_summary) {
          expect(container).toHaveTextContent(metadata.ai_summary);
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

**Unit Test Focus:**
- Component rendering with specific props
- User interactions: clicks, form submissions
- Error states and loading states
- Integration: full page with mocked API responses

### Integration Testing

**End-to-End Tests:**
- Use Playwright for browser automation
- Test full user flow: URL input → API call → 3D rendering → interaction
- Test with real small repositories
- Verify visual output matches expectations

**API Contract Tests:**
- Verify backend response matches expected schema
- Test CORS headers
- Test error responses

### Testing Balance

- Avoid writing too many unit tests for scenarios covered by property tests
- Property tests handle comprehensive input coverage through randomization
- Unit tests focus on:
  - Specific examples demonstrating correct behavior
  - Integration points between components
  - Edge cases and error conditions that are hard to generate randomly
