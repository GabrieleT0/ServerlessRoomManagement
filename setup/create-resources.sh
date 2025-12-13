#!/bin/bash

set -e  # Exit on error

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Azure Serverless Demo - Setup${NC}"
echo -e "${BLUE}========================================${NC}\n"


# CONFIGURATION

RESOURCE_GROUP="rg-aule-demo"
LOCATION="spaincentral" # 
COSMOS_ACCOUNT="cosmos-aule-demo-12987" 
DATABASE_NAME="auledatabase"
CONTAINER_NAME="bookings"
STORAGE_ACCOUNT="stauledemo17839"
FUNCTION_APP="func-aule-demo-12342" # $RANDOM

echo -e "${YELLOW}Configuration:${NC}"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   Location: $LOCATION"
echo "   Cosmos Account: $COSMOS_ACCOUNT"
echo "   Function App: $FUNCTION_APP"
echo "   Storage Account: $STORAGE_ACCOUNT"
echo ""

# 1. VERIFY LOGIN AND SUBSCRIPTION

echo -e "${BLUE} Checking authentication...${NC}"

# Check if the user is logged in
if ! az account show &> /dev/null; then
    echo -e "${YELLOW} Not logged in. Starting login...${NC}"
    az login
fi

# Show active subscription
SUBSCRIPTION=$(az account show --query name -o tsv)
echo -e "${GREEN}Logged in with subscription: $SUBSCRIPTION${NC}\n"


# 2. CREATE RESOURCE GROUP


echo -e "${BLUE}Creating Resource Group...${NC}"

if az group exists --name $RESOURCE_GROUP | grep -q "true"; then
    echo -e "${YELLOW}Resource Group already exists, reusing it.${NC}"
else
    az group create \
        --name $RESOURCE_GROUP \
        --location $LOCATION \
        --output none
    echo -e "${GREEN}Resource Group created${NC}"
fi
echo ""

# 3. CREATE COSMOS DB

echo -e "${BLUE}Creating Cosmos DB... (2-3 min)${NC}"

# Check if Cosmos DB already exists
if az cosmosdb show --name $COSMOS_ACCOUNT --resource-group $RESOURCE_GROUP &> /dev/null; then
    echo -e "${YELLOW}Cosmos DB already exists, reusing it.${NC}"
else
    az cosmosdb create \
        --name $COSMOS_ACCOUNT \
        --resource-group $RESOURCE_GROUP \
        --default-consistency-level Session \
        --locations regionName=$LOCATION failoverPriority=0 isZoneRedundant=False \
        --output none
    echo -e "${GREEN}Cosmos DB account created${NC}"
fi

# Create database
echo "   Creating database..."
az cosmosdb sql database create \
    --account-name $COSMOS_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --name $DATABASE_NAME \
    --output none 2>/dev/null || echo "   Database already exists"

# Create container
echo "   Creating container..."
az cosmosdb sql container create \
    --account-name $COSMOS_ACCOUNT \
    --database-name $DATABASE_NAME \
    --resource-group $RESOURCE_GROUP \
    --name $CONTAINER_NAME \
    --partition-key-path "/roomId" \
    --throughput 400 \
    --output none 2>/dev/null || echo "   Container already exists"

echo -e "${GREEN}Cosmos DB configured${NC}\n"


az cosmosdb sql container update \
    --account-name $COSMOS_ACCOUNT \
    --database-name $DATABASE_NAME \
    --name $CONTAINER_NAME \
    --resource-group $RESOURCE_GROUP \
    --idx @indexingPolicy.json \
    --output none


# 4. CREATE STORAGE ACCOUNT


echo -e "${BLUE}Creating Storage Account...${NC}"

if az storage account show --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP &> /dev/null; then
    echo -e "${YELLOW}Storage Account already exists, reusing it.${NC}"
else
    az storage account create \
        --name $STORAGE_ACCOUNT \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --sku Standard_LRS \
        --output none
    echo -e "${GREEN}Storage Account created${NC}"
fi
echo ""

echo "Waiting 5 minutes so Cosmos DB and the Storage Account are fully provisioned..."
sleep 300

# 5. CREATE FUNCTION APP

echo -e "${BLUE}Creating Function App...${NC}"

if az functionapp show --name $FUNCTION_APP --resource-group $RESOURCE_GROUP &> /dev/null; then
    echo -e "${YELLOW}Function App already exists, reusing it.${NC}"
else
    az functionapp create \
        --name $FUNCTION_APP \
        --resource-group $RESOURCE_GROUP \
        --storage-account $STORAGE_ACCOUNT \
        --consumption-plan-location $LOCATION \
        --runtime node \
        --runtime-version 24 \
        --functions-version 4 \
        --os-type Windows \
        --output none
    echo -e "${GREEN}Function App created${NC}"
fi
echo ""

# 6. CONFIGURE ENVIRONMENT VARIABLES

echo "Waiting 5 minutes so the Function App is fully provisioned..."
sleep 300

echo -e "${BLUE}Configuring environment variables...${NC}"

# Get Cosmos DB connection string
COSMOS_CONNECTION_STRING=$(az cosmosdb keys list \
    --name $COSMOS_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --type connection-strings \
    --query "connectionStrings[0].connectionString" -o tsv)

# Configure app settings
az functionapp config appsettings set \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --settings \
        "COSMOS_CONNECTION_STRING=$COSMOS_CONNECTION_STRING" \
        "COSMOS_DATABASE_NAME=$DATABASE_NAME" \
        "COSMOS_CONTAINER_NAME=$CONTAINER_NAME" \
    --output none

echo -e "${GREEN}Variables configured${NC}\n"

# 7. ENABLE APPLICATION INSIGHTS

echo -e "${BLUE}Enabling Application Insights...${NC}"

az monitor app-insights component create \
    --app $FUNCTION_APP \
    --location $LOCATION \
    --resource-group $RESOURCE_GROUP \
    --output none 2>/dev/null || echo "Application Insights already configured"

echo -e "${GREEN}Application Insights enabled${NC}\n"


# 9. SUMMARY


echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}Backend setup completed successfully!${NC}"
echo -e "${GREEN}======================================================${NC}\n"

echo -e "${BLUE}Resources Created:${NC}"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   Cosmos DB: $COSMOS_ACCOUNT"
echo "   Storage Account: $STORAGE_ACCOUNT"
echo "   Function App: $FUNCTION_APP"
echo ""

echo -e "${BLUE}Now deploy the functions:${NC}"
echo "   1. cd ../backend/functions"
echo "   2. npm install"
echo "   3. func azure functionapp publish $FUNCTION_APP"
echo ""


echo "Deploy Frontend to Azure Static Web Apps"
echo "============================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' 

echo -e "Step 1: ${BLUE}Enabling Static Website Hosting...${NC}"
az storage blob service-properties update \
    --account-name "$STORAGE_ACCOUNT" \
    --static-website \
    --404-document index.html \
    --index-document index.html \
    --output none 

echo -e "${GREEN}Static Website Hosting enabled${NC}"
echo ""

# Upload files
echo -e "Step 2: ${BLUE}Uploading files...${NC}"

# Get storage account key
ACCOUNT_KEY=$(az storage account keys list \
    --account-name "$STORAGE_ACCOUNT" \
    --resource-group "$RESOURCE_GROUP" \
    --query "[0].value" \
    --output tsv)


echo -e "${BLUE}Creating config.js with backend URL...${NC}"


# ==========================================
# Crea config.js con URL backend
# ==========================================

cat > /tmp/config.js << EOF
// config.js - AUTO-GENERATED during deployment
// Generated: $(date)

window.APP_CONFIG = {
    // API Base URL - Configured during deployment
    API_BASE_URL: 'https://${FUNCTION_APP}.azurewebsites.net',
};

// Helper to check if config is valid
window.APP_CONFIG.isConfigured = function() {
    return this.API_BASE_URL && 
           this.API_BASE_URL !== '__API_BASE_URL__' && 
           !this.API_BASE_URL.includes('YOUR-FUNCTION-APP');
};

console.log('Config loaded with backend:', window.APP_CONFIG.API_BASE_URL);
EOF

az storage blob upload \
    --account-name "$STORAGE_ACCOUNT" \
    --account-key "$ACCOUNT_KEY" \
    --container-name '$web' \
    --name "config.js" \
    --file "/tmp/config.js" \
    --content-type "application/javascript" \
    --output none \
    --overwrite

echo "   config.js uploaded"

# Upload HTML
az storage blob upload \
    --account-name "$STORAGE_ACCOUNT" \
    --account-key "$ACCOUNT_KEY" \
    --container-name '$web' \
    --name "index.html" \
    --file "../frontend/index.html" \
    --content-type "text/html" \
    --output none  \
    --overwrite

echo "    index.html uploaded"

# Upload CSS
az storage blob upload \
    --account-name "$STORAGE_ACCOUNT" \
    --account-key "$ACCOUNT_KEY" \
    --container-name '$web' \
    --name "styles.css" \
    --file "../frontend/styles.css" \
    --content-type "text/css" \
    --output none \
    --overwrite

echo "    styles.css uploaded"

# Upload JS
az storage blob upload \
    --account-name "$STORAGE_ACCOUNT" \
    --account-key "$ACCOUNT_KEY" \
    --container-name '$web' \
    --name "script.js" \
    --file "../frontend/script.js" \
    --content-type "application/javascript" \
    --output none \
    --overwrite

echo "    script.js uploaded"

echo -e "${GREEN}All files uploaded${NC}"
echo ""

# Get website URL
WEBSITE_URL=$(az storage account show \
    --name "$STORAGE_ACCOUNT" \
    --resource-group "$RESOURCE_GROUP" \
    --query "primaryEndpoints.web" \
    --output tsv)

# Configure CORS for Function App
az functionapp cors add \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --allowed-origins "${WEBSITE_URL%/}" \
    --output none


#  SAVE CONFIGURATION

echo -e "${BLUE}Saving configuration...${NC}"

cat > ../config.sh << EOF
#!/bin/bash
# Auto-generated configuration file

export RESOURCE_GROUP="$RESOURCE_GROUP"
export FUNCTION_APP="$FUNCTION_APP"
export COSMOS_ACCOUNT="$COSMOS_ACCOUNT"
export DATABASE_NAME="$DATABASE_NAME"
export CONTAINER_NAME="$CONTAINER_NAME"
export STORAGE_ACCOUNT="$STORAGE_ACCOUNT"

# Function App URL
export FUNCTION_URL="https://$FUNCTION_APP.azurewebsites.net"
# Frontend URL
export FRONTEND_URL="$WEBSITE_URL"
EOF

chmod +x ../config.sh

echo -e "${GREEN}Configuration saved to config.sh${NC}\n"

echo ""
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}    Frontend deployment completed successfully!${NC}"
echo -e "${GREEN}======================================================${NC}\n"
echo ""
echo -e "${BLUE}Site URL:${NC}"
echo "   $WEBSITE_URL"
echo ""