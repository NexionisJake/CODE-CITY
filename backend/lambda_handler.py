"""
AWS Lambda handler for CodeCity backend.
The same FastAPI app runs both locally (uvicorn) and on Lambda (Mangum adapter).

Deploy:
  1. pip install mangum --break-system-packages
  2. zip -r deployment.zip . -x "*.pyc" "__pycache__/*"
  3. aws lambda create-function --function-name codecity-api \
       --runtime python3.12 --handler lambda_handler.handler \
       --zip-file fileb://deployment.zip \
       --role arn:aws:iam::ACCOUNT:role/codecity-lambda-role
  4. Add API Gateway trigger (HTTP API, proxy integration)
"""

from mangum import Mangum
from main import app

# Lambda handler — wraps FastAPI app with ASGI adapter
handler = Mangum(app, lifespan="off")

# For local testing:
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
