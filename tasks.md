# Implementation Plan: CodeCity

## Overview

This implementation plan breaks down the CodeCity 3D repository visualizer into discrete coding tasks. The backend (Python FastAPI) handles repository analysis and the frontend (Next.js + React Three Fiber) handles 3D visualization. Tasks are organized to build incrementally, with testing integrated throughout to catch errors early.

## Tasks

- [ ] 1. Set up monorepo project structure
  - Create root directory with backend/ and frontend/ subdirectories
  - Initialize backend/ with Python project (pyproject.toml, requirements.txt)
  - Initialize frontend/ with Next.js 14 project using TypeScript
  - Create root README with project overview and setup instructions
  - Add .gitignore for Python and Node.js
  - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 2. Implement backend repository ingestion module
  - [ ] 2.1 Create repository ingestion function with GitHub ZIP download
    - Implement async function to download repository from GitHub (main/master fallback)
    - Extract ZIP to temporary directory
    - Filter out noise directories (node_modules, .git, __pycache__, venv, dist, build)
    - _Requirements: 1.1, 1.2, 1.3, 1.5_
  
  - [ ]* 2.2 Write property test for repository download and extraction
    - **Property 1: Repository download and extraction**
    - **Validates: Requirements 1.1, 1.3**
  
  - [ ]* 2.3 Write property test for branch fallback
    - **Property 2: Branch fallback behavior**
    - **Validates: Requirements 1.2**
  
  - [ ]* 2.4 Write property test for invalid URL handling
    - **Property 3: Invalid URL error handling**
    - **Validates: Requirements 1.4**
  
  - [ ]* 2.5 Write property test for noise directory filtering
    - **Property 4: Noise directory filtering**
    - **Validates: Requirements 1.5**

- [ ] 3. Implement backend AST parsing module
  - [ ] 3.1 Create AST parser with tree-sitter support
    - Set up tree-sitter parsers for Python, JavaScript, TypeScript, JSX, TSX
    - Implement parse_file function that selects parser based on file extension
    - Handle parsing errors gracefully with warnings
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  
  - [ ]* 3.2 Write property test for multi-language parsing
    - **Property 5: Multi-language AST parsing**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.7**
  
  - [ ]* 3.3 Write property test for parse error resilience
    - **Property 6: Parse error resilience**
    - **Validates: Requirements 2.6, 13.1**

- [ ] 4. Implement backend dependency graph extraction
  - [ ] 4.1 Create dependency extractor with import statement extraction
    - Query AST for import nodes (Python: import_statement, import_from_statement; JS/TS: import_statement, require calls)
    - Extract module names from import nodes
    - Implement heuristic path resolution (relative/absolute, try common extensions)
    - Build directed dependency graph
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  
  - [ ]* 4.2 Write property test for import extraction completeness
    - **Property 7: Import extraction completeness**
    - **Validates: Requirements 3.1, 3.2**
  
  - [ ]* 4.3 Write property test for dependency graph edge creation
    - **Property 8: Dependency graph edge creation**
    - **Validates: Requirements 3.3, 3.6**
  
  - [ ]* 4.4 Write property test for import path resolution
    - **Property 9: Import path resolution**
    - **Validates: Requirements 3.4**
  
  - [ ]* 4.5 Write property test for external import filtering
    - **Property 10: External import filtering**
    - **Validates: Requirements 3.5**

- [ ] 5. Implement backend metrics calculation module
  - [ ] 5.1 Create metrics calculator with Radon integration
    - Use Radon for Python files (LOC, cyclomatic complexity, function count)
    - Implement AST-based fallback for JavaScript/TypeScript files
    - Handle errors with fallback metrics and warnings
    - _Requirements: 4.1, 4.2, 4.3, 4.7_
  
  - [ ]* 5.2 Write property test for comprehensive metrics calculation
    - **Property 11: Comprehensive metrics calculation**
    - **Validates: Requirements 4.1, 4.2, 4.3**
  
  - [ ]* 5.3 Write property test for metrics fallback on error
    - **Property 15: Metrics fallback on error**
    - **Validates: Requirements 4.7, 13.3**

- [ ] 6. Implement backend dimensional mapping
  - [ ] 6.1 Create functions to map metrics to building dimensions and colors
    - Map LOC to height (LOC / 10)
    - Map function count to width/depth (sqrt(function_count) * 2, minimum 2)
    - Map complexity to color (≤5: green, 5-10: yellow, >10: red)
    - _Requirements: 4.4, 4.5, 4.6_
  
  - [ ]* 6.2 Write property test for LOC to height mapping
    - **Property 12: LOC to height mapping**
    - **Validates: Requirements 4.4**
  
  - [ ]* 6.3 Write property test for function count to dimensions mapping
    - **Property 13: Function count to dimensions mapping**
    - **Validates: Requirements 4.5**
  
  - [ ]* 6.4 Write property test for complexity to color mapping
    - **Property 14: Complexity to color mapping**
    - **Validates: Requirements 4.6**

- [ ] 7. Checkpoint - Ensure backend core modules work together
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement backend AI enrichment module
  - [ ] 8.1 Create AI enrichment module with AWS Bedrock integration
    - Set up boto3 Bedrock client
    - Implement file selection (top 15 by LOC)
    - Create async function to generate summaries using Claude 3 Haiku
    - Use asyncio.gather() for concurrent API calls
    - Handle failures gracefully with warnings
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [ ]* 8.2 Write property test for AI enrichment file cap
    - **Property 16: AI enrichment file cap**
    - **Validates: Requirements 5.1**
  
  - [ ]* 8.3 Write property test for AI enrichment prompt structure
    - **Property 17: AI enrichment prompt structure**
    - **Validates: Requirements 5.3, 5.4**
  
  - [ ]* 8.4 Write property test for AI summary attachment
    - **Property 18: AI summary attachment**
    - **Validates: Requirements 5.5**
  
  - [ ]* 8.5 Write property test for AI enrichment error resilience
    - **Property 19: AI enrichment error resilience**
    - **Validates: Requirements 5.6, 13.2**

- [ ] 9. Implement backend spatial layout generation
  - [ ] 9.1 Create spatial layout generator with directory clustering
    - Group files by parent directory
    - Assign grid regions to directory clusters
    - Arrange files within clusters in grid pattern (10 unit spacing)
    - Calculate y-coordinate as height / 2 for ground anchoring
    - Ensure no building overlaps
    - Center layout around origin
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [ ]* 9.2 Write property test for position generation completeness
    - **Property 20: Position generation completeness**
    - **Validates: Requirements 6.1, 6.6**
  
  - [ ]* 9.3 Write property test for directory clustering
    - **Property 21: Directory clustering**
    - **Validates: Requirements 6.2**
  
  - [ ]* 9.4 Write property test for ground anchoring
    - **Property 22: Ground anchoring**
    - **Validates: Requirements 6.3**
  
  - [ ]* 9.5 Write property test for no building overlap
    - **Property 23: No building overlap**
    - **Validates: Requirements 6.4**
  
  - [ ]* 9.6 Write property test for grid-based positioning
    - **Property 24: Grid-based positioning**
    - **Validates: Requirements 6.5**

- [ ] 10. Implement backend API endpoint and pipeline orchestration
  - [ ] 10.1 Create FastAPI application with /api/build-city endpoint
    - Define Pydantic models for request/response
    - Implement pipeline orchestrator that calls all modules in sequence
    - Collect warnings throughout pipeline
    - Build Building and Road response objects
    - Handle critical errors with error responses
    - Enable CORS for frontend origin
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [ ]* 10.2 Write property test for successful pipeline response structure
    - **Property 25: Successful pipeline response structure**
    - **Validates: Requirements 7.4**
  
  - [ ]* 10.3 Write property test for failed pipeline error response
    - **Property 26: Failed pipeline error response**
    - **Validates: Requirements 7.5, 13.5**
  
  - [ ]* 10.4 Write property test for partial results with warnings
    - **Property 27: Partial results with warnings**
    - **Validates: Requirements 13.4**
  
  - [ ]* 10.5 Write unit tests for CORS headers
    - Verify CORS headers are present in responses
    - _Requirements: 7.6_

- [ ] 11. Create backend Dockerfile and deployment configuration
  - [ ] 11.1 Create Dockerfile for backend
    - Use Python 3.11+ base image
    - Install dependencies from requirements.txt
    - Expose port 8000
    - Set up entry point for FastAPI server
    - _Requirements: 12.1, 12.2_
  
  - [ ]* 11.2 Write unit test for port configuration
    - Verify server listens on port 8000
    - _Requirements: 12.2_

- [ ] 12. Checkpoint - Ensure backend is complete and testable
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement frontend URL input component
  - [ ] 13.1 Create URLInput component with form and validation
    - Text input field with GitHub URL validation
    - Submit button with loading state
    - Error message display
    - _Requirements: 8.1_
  
  - [ ]* 13.2 Write unit test for URL input field existence
    - Verify input field is rendered
    - _Requirements: 8.1_

- [ ] 14. Implement frontend API integration
  - [ ] 14.1 Create API client function for /api/build-city
    - Implement POST request with repository URL
    - Handle loading states
    - Handle error responses
    - Use environment variable for API URL
    - _Requirements: 8.2, 8.9, 8.10, 12.6_
  
  - [ ]* 14.2 Write property test for API request on URL submission
    - **Property 28: API request on URL submission**
    - **Validates: Requirements 8.2**
  
  - [ ]* 14.3 Write property test for error message display
    - **Property 36: Error message display**
    - **Validates: Requirements 8.10**
  
  - [ ]* 14.4 Write unit test for loading state handling
    - Verify loading indicator appears during API calls
    - _Requirements: 8.9_

- [ ] 15. Implement frontend Building component
  - [ ] 15.1 Create Building component with BoxGeometry mesh
    - Render BoxGeometry with dimensions from props
    - Apply MeshStandardMaterial with color from props
    - Position mesh using position from props
    - Add onClick handler for tooltip
    - Add hover effect (scale increase)
    - _Requirements: 8.4, 9.1, 9.2, 9.3_
  
  - [ ]* 15.2 Write property test for building mesh rendering
    - **Property 29: Building mesh rendering**
    - **Validates: Requirements 8.4, 9.1, 9.2, 9.3**

- [ ] 16. Implement frontend Road component
  - [ ] 16.1 Create Road component with line geometry
    - Create line connecting start and end building positions
    - Use LineBasicMaterial with cyan color and opacity
    - Add arrow helper for direction indicator when directed=true
    - _Requirements: 8.5, 10.1, 10.2, 10.3, 10.6_
  
  - [ ]* 16.2 Write property test for road line rendering
    - **Property 30: Road line rendering**
    - **Validates: Requirements 8.5, 10.1**
  
  - [ ]* 16.3 Write property test for directed road indicators
    - **Property 31: Directed road indicators**
    - **Validates: Requirements 10.2, 10.3**
  
  - [ ]* 16.4 Write property test for road endpoint positioning
    - **Property 32: Road endpoint positioning**
    - **Validates: Requirements 10.6**
  
  - [ ]* 16.5 Write unit test for road color distinction
    - Verify road color is distinct from building colors
    - _Requirements: 10.4_

- [ ] 17. Implement frontend Tooltip component
  - [ ] 17.1 Create Tooltip component with metadata display
    - Overlay positioned at screen coordinates
    - Display file path, LOC, complexity, function count
    - Display AI summary when available
    - Close button and click-outside-to-close behavior
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_
  
  - [ ]* 17.2 Write property test for building click tooltip display
    - **Property 33: Building click tooltip display**
    - **Validates: Requirements 8.8, 11.1**
  
  - [ ]* 17.3 Write property test for tooltip content completeness
    - **Property 34: Tooltip content completeness**
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6**
  
  - [ ]* 17.4 Write property test for tooltip closing behavior
    - **Property 35: Tooltip closing behavior**
    - **Validates: Requirements 11.7**

- [ ] 18. Implement frontend CityCanvas component
  - [ ] 18.1 Create CityCanvas component with React Three Fiber
    - Set up full-screen Canvas with camera and lights
    - Add OrbitControls for navigation
    - Render ground grid helper
    - Render Building components for each building in data
    - Render Road components for each road in data
    - Handle building click events
    - _Requirements: 8.3, 8.6, 8.7_
  
  - [ ]* 18.2 Write unit tests for canvas setup
    - Verify Canvas component is rendered
    - Verify ground grid is rendered
    - Verify OrbitControls are present
    - _Requirements: 8.3, 8.6, 8.7_

- [ ] 19. Implement frontend main page component
  - [ ] 19.1 Create main page with state management and component composition
    - Set up state for city data, selected building, loading, errors
    - Compose URLInput, CityCanvas, and Tooltip components
    - Handle API call orchestration
    - Display warnings in non-intrusive banner
    - _Requirements: 13.6, 13.7_
  
  - [ ]* 19.2 Write unit tests for warning display
    - Verify warnings are displayed when present
    - _Requirements: 13.6_
  
  - [ ]* 19.3 Write unit tests for error display
    - Verify errors are displayed prominently
    - _Requirements: 13.7_

- [ ] 20. Create frontend deployment configuration
  - [ ] 20.1 Configure Next.js for AWS Amplify deployment
    - Set up next.config.js with appropriate settings
    - Configure environment variables for API URL
    - Add deployment documentation to frontend README
    - _Requirements: 12.4, 12.6_
  
  - [ ]* 20.2 Write unit test for environment variable usage
    - Verify frontend reads API URL from env vars
    - _Requirements: 12.6_

- [ ] 21. Final checkpoint - Integration testing and documentation
  - [ ] 21.1 Run full integration test with small test repository
    - Test complete flow: URL input → API call → 3D rendering → interaction
    - Verify buildings and roads render correctly
    - Verify tooltips display correct information
    - Verify error handling works end-to-end
  
  - [ ] 21.2 Update documentation
    - Complete root README with setup and deployment instructions
    - Complete backend README with API documentation
    - Complete frontend README with component documentation
    - Add architecture diagrams if helpful
    - _Requirements: 14.4, 14.5_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using Hypothesis (backend) and fast-check (frontend)
- Unit tests validate specific examples and edge cases
- Backend uses Python 3.11+, FastAPI, tree-sitter, Radon, boto3
- Frontend uses Next.js 14, React 18, React Three Fiber, TypeScript
- Both backend and frontend have separate test suites with property-based testing configured for minimum 100 iterations
