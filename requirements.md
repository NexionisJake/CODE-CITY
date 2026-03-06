# Requirements Document: CodeCity

## Introduction

CodeCity is a 3D GitHub repository visualizer that transforms code repositories into interactive 3D cities in the browser. Files become buildings with dimensions representing code metrics, imports become roads connecting buildings, and AI provides intelligent summaries of each file. The system consists of a Python FastAPI backend for repository analysis and a Next.js/React Three Fiber frontend for 3D visualization.

## Glossary

- **System**: The complete CodeCity application (backend + frontend)
- **Backend**: Python FastAPI service responsible for repository analysis
- **Frontend**: Next.js/React Three Fiber web application for 3D visualization
- **Repository**: A GitHub repository to be visualized
- **Building**: A 3D mesh representing a source code file
- **Road**: A 3D line representing an import dependency between files
- **AST**: Abstract Syntax Tree used for code parsing
- **Tree_Sitter**: Multi-language parser library for AST generation
- **Radon**: Python library for code metrics calculation
- **AI_Enrichment**: AWS Bedrock Claude 3 Haiku summaries of file purpose
- **Spatial_Layout**: Algorithm for positioning buildings in 3D space
- **Dependency_Graph**: Directed graph of import relationships between files
- **Complexity**: Cyclomatic complexity metric for code
- **LOC**: Lines of Code metric

## Requirements

### Requirement 1: GitHub Repository Ingestion

**User Story:** As a developer, I want to input a GitHub repository URL, so that the system can download and analyze the repository code.

#### Acceptance Criteria

1. WHEN a valid GitHub repository URL is provided, THE Backend SHALL download the repository as a zip file from the main or master branch
2. WHEN the main branch does not exist, THE Backend SHALL attempt to download from the master branch as fallback
3. WHEN the repository download succeeds, THE Backend SHALL extract the zip file contents to a temporary directory
4. WHEN the repository URL is invalid or inaccessible, THE Backend SHALL return a descriptive error message
5. THE Backend SHALL skip common noise directories including node_modules, .git, __pycache__, venv, dist, and build during extraction

### Requirement 2: Multi-Language AST Parsing

**User Story:** As a developer, I want the system to parse multiple programming languages, so that I can visualize repositories using Python, JavaScript, or TypeScript.

#### Acceptance Criteria

1. WHEN a Python file is encountered, THE Backend SHALL parse it using Tree_Sitter Python grammar
2. WHEN a JavaScript file is encountered, THE Backend SHALL parse it using Tree_Sitter JavaScript grammar
3. WHEN a TypeScript file is encountered, THE Backend SHALL parse it using Tree_Sitter TypeScript grammar
4. WHEN a JSX file is encountered, THE Backend SHALL parse it using Tree_Sitter JSX grammar
5. WHEN a TSX file is encountered, THE Backend SHALL parse it using Tree_Sitter TSX grammar
6. WHEN a file cannot be parsed, THE Backend SHALL add a warning to the warnings array and continue processing other files
7. THE Backend SHALL extract the complete AST for each successfully parsed file

### Requirement 3: Dependency Graph Extraction

**User Story:** As a developer, I want to see import relationships between files, so that I can understand the architecture and dependencies in the codebase.

#### Acceptance Criteria

1. WHEN parsing a Python file, THE Backend SHALL extract all import statements including from-imports and direct imports
2. WHEN parsing a JavaScript or TypeScript file, THE Backend SHALL extract all import statements including ES6 imports and require statements
3. WHEN an import statement references another file in the repository, THE Backend SHALL create a directed edge in the Dependency_Graph
4. THE Backend SHALL use heuristic matching to resolve relative and absolute import paths to actual file paths
5. WHEN an import cannot be resolved to a file in the repository, THE Backend SHALL skip that import without adding it to the Dependency_Graph
6. THE Backend SHALL preserve the direction of dependencies where the importing file points to the imported file

### Requirement 4: Code Metrics Calculation

**User Story:** As a developer, I want buildings to reflect code metrics, so that I can quickly identify large, complex, or function-heavy files.

#### Acceptance Criteria

1. WHEN analyzing a file, THE Backend SHALL calculate the total lines of code using Radon
2. WHEN analyzing a file, THE Backend SHALL calculate the cyclomatic complexity using Radon
3. WHEN analyzing a file, THE Backend SHALL count the number of functions or methods in the file
4. THE Backend SHALL map LOC to building height where height equals LOC divided by a scaling factor
5. THE Backend SHALL map function count to building width and depth
6. THE Backend SHALL map cyclomatic complexity to building color where complexity ≤5 is green, 5-10 is yellow, and >10 is red
7. WHEN Radon cannot analyze a file, THE Backend SHALL use fallback metrics based on file size and AST node count

### Requirement 5: AI Enrichment via AWS Bedrock

**User Story:** As a developer, I want AI-generated summaries of files, so that I can quickly understand the purpose of each file without reading the code.

#### Acceptance Criteria

1. WHEN files are ready for AI_Enrichment, THE Backend SHALL select up to 15 files for summary generation
2. THE Backend SHALL invoke AWS Bedrock Claude 3 Haiku model for each selected file using asyncio.gather for concurrent execution
3. WHEN invoking Bedrock, THE Backend SHALL provide the file path and file content as context
4. WHEN invoking Bedrock, THE Backend SHALL request a concise summary of the file's purpose and key functionality
5. WHEN a Bedrock call succeeds, THE Backend SHALL attach the summary to the building metadata
6. WHEN a Bedrock call fails, THE Backend SHALL add a warning to the warnings array and continue processing other files
7. THE Backend SHALL require IAM permissions for bedrock:InvokeModel action

### Requirement 6: Spatial Layout Generation

**User Story:** As a developer, I want files from the same directory to be visually grouped, so that I can understand the repository structure at a glance.

#### Acceptance Criteria

1. THE Backend SHALL generate 3D positions for all buildings using a directory-clustered grid layout algorithm
2. WHEN positioning buildings, THE Backend SHALL group files from the same directory into spatial clusters
3. WHEN calculating building position, THE Backend SHALL set the y-coordinate to height divided by 2 to anchor buildings on the ground plane
4. THE Backend SHALL ensure buildings do not overlap by maintaining minimum spacing between adjacent buildings
5. THE Backend SHALL assign x and z coordinates based on grid positions within directory clusters
6. THE Backend SHALL return position data as {x, y, z} coordinates in the API response

### Requirement 7: REST API Endpoint

**User Story:** As a frontend developer, I want a single API endpoint to orchestrate the full pipeline, so that I can request city data with one HTTP call.

#### Acceptance Criteria

1. THE Backend SHALL expose a POST endpoint at /api/build-city
2. WHEN the endpoint receives a request, THE Backend SHALL accept a JSON body containing a repository URL
3. THE Backend SHALL orchestrate the full pipeline: ingestion, parsing, dependency extraction, metrics calculation, AI enrichment, and spatial layout
4. WHEN the pipeline succeeds, THE Backend SHALL return a JSON response with repository name, buildings array, roads array, and warnings array
5. WHEN the pipeline fails, THE Backend SHALL return a JSON response with an error field containing a descriptive error message
6. THE Backend SHALL include CORS headers to allow requests from the Frontend origin
7. THE Backend SHALL complete the request within a reasonable timeout period accounting for AI enrichment latency

### Requirement 8: 3D Visualization Frontend

**User Story:** As a user, I want to see the repository as an interactive 3D city, so that I can explore the codebase visually.

#### Acceptance Criteria

1. THE Frontend SHALL provide an input field for GitHub repository URLs
2. WHEN a user submits a repository URL, THE Frontend SHALL send a POST request to the Backend /api/build-city endpoint
3. WHEN the Backend response is received, THE Frontend SHALL render a full-screen 3D canvas using React Three Fiber
4. THE Frontend SHALL create BoxGeometry meshes for each building with dimensions and colors from the API response
5. THE Frontend SHALL create line geometries for each road showing directed import relationships
6. THE Frontend SHALL render a ground grid for spatial reference
7. THE Frontend SHALL provide orbit controls allowing users to rotate, pan, and zoom the camera
8. WHEN a user clicks on a building, THE Frontend SHALL display a tooltip with file metadata and AI summary
9. THE Frontend SHALL handle loading states while waiting for the Backend response
10. WHEN the Backend returns an error, THE Frontend SHALL display an error message to the user

### Requirement 9: Building Visual Encoding

**User Story:** As a user, I want building appearance to encode code metrics, so that I can identify problematic files at a glance.

#### Acceptance Criteria

1. WHEN rendering a building, THE Frontend SHALL set the height based on the height value from the API response
2. WHEN rendering a building, THE Frontend SHALL set the width and depth based on the dimensions from the API response
3. WHEN rendering a building, THE Frontend SHALL set the color based on the RGB values from the API response
4. THE Frontend SHALL use green color (RGB) for buildings with complexity ≤5
5. THE Frontend SHALL use yellow color (RGB) for buildings with complexity between 5 and 10
6. THE Frontend SHALL use red color (RGB) for buildings with complexity >10
7. THE Frontend SHALL ensure all buildings are visible and distinguishable in the 3D scene

### Requirement 10: Import Relationship Visualization

**User Story:** As a user, I want to see which files import which other files, so that I can understand data flow and dependencies.

#### Acceptance Criteria

1. WHEN rendering roads, THE Frontend SHALL create a line from the start building position to the end building position
2. THE Frontend SHALL use the directed flag from the API response to determine road directionality
3. WHEN a road is directed, THE Frontend SHALL render a visual indicator showing the direction of the import
4. THE Frontend SHALL use a distinct color for roads to differentiate them from buildings
5. THE Frontend SHALL ensure roads are visible against the background and ground grid
6. WHEN buildings are positioned at different heights, THE Frontend SHALL render roads connecting the building centers

### Requirement 11: Interactive Tooltips

**User Story:** As a user, I want to click on buildings to see detailed information, so that I can learn about specific files without leaving the visualization.

#### Acceptance Criteria

1. WHEN a user clicks on a building, THE Frontend SHALL display a tooltip overlay
2. THE Frontend SHALL include the file path in the tooltip
3. THE Frontend SHALL include the LOC metric in the tooltip
4. THE Frontend SHALL include the cyclomatic complexity metric in the tooltip
5. THE Frontend SHALL include the function count metric in the tooltip
6. WHERE an AI summary is available, THE Frontend SHALL include the summary in the tooltip
7. WHEN a user clicks outside the tooltip or on another building, THE Frontend SHALL close the current tooltip

### Requirement 12: Deployment Configuration

**User Story:** As a DevOps engineer, I want clear deployment configurations, so that I can deploy the system to AWS infrastructure.

#### Acceptance Criteria

1. THE Backend SHALL be containerized using Docker with all dependencies included
2. THE Backend SHALL expose port 8000 for HTTP traffic
3. THE Backend SHALL be deployable to AWS App Runner using the Docker container
4. THE Frontend SHALL be deployable to AWS Amplify as a Next.js application
5. THE System SHALL require environment variables for AWS credentials configuration
6. THE System SHALL require environment variables for API URL configuration to connect Frontend to Backend
7. THE Backend SHALL require an IAM role with bedrock:InvokeModel permission attached to the App Runner service

### Requirement 13: Error Handling and Resilience

**User Story:** As a user, I want the system to handle errors gracefully, so that partial failures don't prevent me from seeing any visualization.

#### Acceptance Criteria

1. WHEN a file cannot be parsed, THE Backend SHALL add a warning to the warnings array and continue processing
2. WHEN an AI enrichment call fails, THE Backend SHALL add a warning to the warnings array and continue processing
3. WHEN a metric calculation fails, THE Backend SHALL use fallback values and add a warning to the warnings array
4. THE Backend SHALL return partial results with warnings rather than failing completely when non-critical errors occur
5. WHEN a critical error occurs that prevents city generation, THE Backend SHALL return an error response with a descriptive message
6. THE Frontend SHALL display warnings to the user in a non-intrusive manner
7. THE Frontend SHALL display critical errors prominently with actionable guidance

### Requirement 14: Monorepo Project Structure

**User Story:** As a developer, I want a clear monorepo structure, so that I can navigate and maintain both backend and frontend codebases easily.

#### Acceptance Criteria

1. THE System SHALL organize code in a monorepo with separate backend/ and frontend/ directories
2. THE Backend SHALL reside in the backend/ directory with its own dependencies and configuration
3. THE Frontend SHALL reside in the frontend/ directory with its own dependencies and configuration
4. THE System SHALL include a root-level README documenting the project structure and setup instructions
5. THE System SHALL include separate README files in backend/ and frontend/ directories with component-specific documentation
6. THE Backend SHALL include a Dockerfile for containerization
7. THE Frontend SHALL include Next.js configuration for AWS Amplify deployment
