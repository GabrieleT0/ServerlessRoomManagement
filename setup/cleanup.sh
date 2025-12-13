#!/bin/bash

# Azure Resources Cleanup Script

set -e

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${RED}========================================${NC}"
echo -e "${RED}  Azure Resources Cleanup${NC}"
echo -e "${RED}========================================${NC}\n"

# Load configuration if present
if [ -f ../config.sh ]; then
    source ../config.sh
    echo -e "${YELLOW}Configuration loaded:${NC}"
    echo "   Resource Group: $RESOURCE_GROUP"
    echo ""
else
    echo -e "${YELLOW}config.sh not found.${NC}"
    read -p "Enter the Resource Group to delete: " RESOURCE_GROUP
fi

# Confirmation
echo -e "${RED}WARNING: This operation will delete:${NC}"
echo "   - Resource Group: $RESOURCE_GROUP"
echo "   - All contained resources (Cosmos DB, Functions, Storage, etc.)"
echo ""
read -p "Are you sure? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${GREEN}Operation canceled.${NC}"
    exit 0
fi

echo ""
echo -e "${RED}Deletion in progress...${NC}"

# Elimina il resource group (elimina automaticamente tutte le risorse)
az group delete \
    --name $RESOURCE_GROUP \
    --yes \
    --no-wait

echo -e "${GREEN}✓ Delete command sent${NC}"
echo ""
echo -e "${YELLOW}Deletion runs in the background and can take a few minutes.${NC}"
echo -e "${YELLOW}   Check status in the Azure portal or with:${NC}"
echo -e "${YELLOW}   az group show --name $RESOURCE_GROUP${NC}"
echo ""

# Remove configuration file
if [ -f ../config.sh ]; then
    rm ../config.sh
    echo -e "${GREEN}config.sh removed${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Cleanup Completed${NC}"
echo -e "${GREEN}========================================${NC}\n"
