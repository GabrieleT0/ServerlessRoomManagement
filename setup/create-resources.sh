#!/bin/bash

set -e  # Exit on error

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Azure Serverless Demo - Setup${NC}"
echo -e "${BLUE}========================================${NC}\n"


# CONFIGURAZIONE - MODIFICA QUESTI VALORI

RESOURCE_GROUP="rg-aule-demo"
LOCATION="spaincentral" # 
COSMOS_ACCOUNT="cosmos-aule-demo-12987"  # Aggiunge numero random per unicità
DATABASE_NAME="auledatabase"
CONTAINER_NAME="bookings"
STORAGE_ACCOUNT="stauledemo17839"
FUNCTION_APP="func-aule-demo-12342" # $RANDOM

echo -e "${YELLOW}Configurazione:${NC}"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   Location: $LOCATION"
echo "   Cosmos Account: $COSMOS_ACCOUNT"
echo "   Function App: $FUNCTION_APP"
echo "   Storage Account: $STORAGE_ACCOUNT"
echo ""

# 1. VERIFICA LOGIN E SOTTOSCRIZIONE

echo -e "${BLUE} Verifica autenticazione...${NC}"

# Verifica se l'utente è loggato
if ! az account show &> /dev/null; then
    echo -e "${YELLOW} Non sei loggato. Avvio login...${NC}"
    az login
fi

# Mostra la sottoscrizione attiva
SUBSCRIPTION=$(az account show --query name -o tsv)
echo -e "${GREEN}Loggato con sottoscrizione: $SUBSCRIPTION${NC}\n"


# 2. CREA RESOURCE GROUP


echo -e "${BLUE}Creazione Resource Group...${NC}"

if az group exists --name $RESOURCE_GROUP | grep -q "true"; then
    echo -e "${YELLOW}Resource Group già esistente, lo uso.${NC}"
else
    az group create \
        --name $RESOURCE_GROUP \
        --location $LOCATION \
        --output none
    echo -e "${GREEN}Resource Group creato${NC}"
fi
echo ""

# 3. CREA COSMOS DB

echo -e "${BLUE}Creazione Cosmos DB... (2-3 min)${NC}"

# Verifica se Cosmos DB esiste già
if az cosmosdb show --name $COSMOS_ACCOUNT --resource-group $RESOURCE_GROUP &> /dev/null; then
    echo -e "${YELLOW}Cosmos DB già esistente, lo uso.${NC}"
else
    az cosmosdb create \
        --name $COSMOS_ACCOUNT \
        --resource-group $RESOURCE_GROUP \
        --default-consistency-level Session \
        --locations regionName=$LOCATION failoverPriority=0 isZoneRedundant=False \
        --output none
    echo -e "${GREEN}Cosmos DB account creato${NC}"
fi

# Crea database
echo "   Creazione database..."
az cosmosdb sql database create \
    --account-name $COSMOS_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --name $DATABASE_NAME \
    --output none 2>/dev/null || echo "   Database già esistente"

# Crea container
echo "   Creazione container..."
az cosmosdb sql container create \
    --account-name $COSMOS_ACCOUNT \
    --database-name $DATABASE_NAME \
    --resource-group $RESOURCE_GROUP \
    --name $CONTAINER_NAME \
    --partition-key-path "/roomId" \
    --throughput 400 \
    --output none 2>/dev/null || echo "   Container già esistente"

echo -e "${GREEN}Cosmos DB configurato${NC}\n"


az cosmosdb sql container update \
    --account-name $COSMOS_ACCOUNT \
    --database-name $DATABASE_NAME \
    --name $CONTAINER_NAME \
    --resource-group $RESOURCE_GROUP \
    --idx @indexingPolicy.json \
    --output none


# 4. CREA STORAGE ACCOUNT


echo -e "${BLUE}Creazione Storage Account...${NC}"

if az storage account show --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP &> /dev/null; then
    echo -e "${YELLOW}Storage Account già esistente, lo uso.${NC}"
else
    az storage account create \
        --name $STORAGE_ACCOUNT \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --sku Standard_LRS \
        --output none
    echo -e "${GREEN}✓ Storage Account creato${NC}"
fi
echo ""

echo "Aspetto 5 minuti in modo che Cosmos DB e lo Storage Account siano completamente provisionati..."
sleep 300

# 5. CREA FUNCTION APP

echo -e "${BLUE}Creazione Function App...${NC}"

if az functionapp show --name $FUNCTION_APP --resource-group $RESOURCE_GROUP &> /dev/null; then
    echo -e "${YELLOW}Function App già esistente, la uso.${NC}"
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
    echo -e "${GREEN}Function App creata${NC}"
fi
echo ""

# 6. CONFIGURA VARIABILI D'AMBIENTE

echo "Aspetto 5 minuti in modo che la Function App sia completamente provisionata..."
sleep 300

echo -e "${BLUE}Configurazione variabili d'ambiente...${NC}"

# Ottieni connection string di Cosmos DB
COSMOS_CONNECTION_STRING=$(az cosmosdb keys list \
    --name $COSMOS_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --type connection-strings \
    --query "connectionStrings[0].connectionString" -o tsv)

# Configura app settings
az functionapp config appsettings set \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --settings \
        "COSMOS_CONNECTION_STRING=$COSMOS_CONNECTION_STRING" \
        "COSMOS_DATABASE_NAME=$DATABASE_NAME" \
        "COSMOS_CONTAINER_NAME=$CONTAINER_NAME" \
    --output none

echo -e "${GREEN}Variabili configurate${NC}\n"

# 7. ABILITA APPLICATION INSIGHTS

echo -e "${BLUE}Abilitazione Application Insights...${NC}"

az monitor app-insights component create \
    --app $FUNCTION_APP \
    --location $LOCATION \
    --resource-group $RESOURCE_GROUP \
    --output none 2>/dev/null || echo "Application Insights già configurato"

echo -e "${GREEN}Application Insights abilitato${NC}\n"


# 9. RIEPILOGO


echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}Setup del Backend Completato con Successo!${NC}"
echo -e "${GREEN}======================================================${NC}\n"

echo -e "${BLUE}Risorse Create:${NC}"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   Cosmos DB: $COSMOS_ACCOUNT"
echo "   Storage Account: $STORAGE_ACCOUNT"
echo "   Function App: $FUNCTION_APP"
echo ""

echo -e "${BLUE}Adesso esegui deploy delle function:${NC}"
echo "   1. cd ../backend/functions"
echo "   2. npm install"
echo "   3. func azure functionapp publish $FUNCTION_APP"
echo ""


echo "Deploy Frontend su Azure Static Web Apps"
echo "============================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' 

echo -e "Step 1: ${BLUE}Abilitazione Static Website Hosting...${NC}"
az storage blob service-properties update \
    --account-name "$STORAGE_ACCOUNT" \
    --static-website \
    --404-document index.html \
    --index-document index.html \
    --output none 

echo -e "${GREEN}Static Website Hosting abilitato${NC}"
echo ""

# Upload dei file
echo -e "Step 2: ${BLUE}Upload dei file...${NC}"

# Get storage account key
ACCOUNT_KEY=$(az storage account keys list \
    --account-name "$STORAGE_ACCOUNT" \
    --resource-group "$RESOURCE_GROUP" \
    --query "[0].value" \
    --output tsv)


echo -e "${BLUE}Creazione config.js con URL backend...${NC}"


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

echo "   config.js caricato"

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

echo "    index.html caricato"

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

echo "    styles.css caricato"

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

echo "    script.js caricato"

echo -e "${GREEN}Tutti i file caricati${NC}"
echo ""

# Get website URL
WEBSITE_URL=$(az storage account show \
    --name "$STORAGE_ACCOUNT" \
    --resource-group "$RESOURCE_GROUP" \
    --query "primaryEndpoints.web" \
    --output tsv)

# Configura CORS per Function App
az functionapp cors add \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --allowed-origins "${WEBSITE_URL%/}" \
    --output none

# az storage blob upload \
#     --account-name "$STORAGE_ACCOUNT" \
#     --account-key "$ACCOUNT_KEY" \
#     --container-name '$web' \
#     --name "config.js" \
#     --file "/tmp/config.js" \
#     --content-type "application/javascript" \
#     --output none \
#     --overwrite

# echo "    config.js caricato"

# ============================================
#  SALVA CONFIGURAZIONE
# ============================================

echo -e "${BLUE}Salvataggio configurazione...${NC}"

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

echo -e "${GREEN}Configurazione salvata in config.sh${NC}\n"

echo ""
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}    Deploy del Frontend Completato con Successo!${NC}"
echo -e "${GREEN}======================================================${NC}\n"
echo ""
echo -e "${BLUE}URL del sito:${NC}"
echo "   $WEBSITE_URL"
echo ""