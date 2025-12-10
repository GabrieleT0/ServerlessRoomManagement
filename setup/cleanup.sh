#!/bin/bash

# Script di Cleanup Risorse Azure

set -e

# Colori
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${RED}========================================${NC}"
echo -e "${RED}  Azure Resources Cleanup${NC}"
echo -e "${RED}========================================${NC}\n"

# Carica configurazione se esiste
if [ -f ../config.sh ]; then
    source ../config.sh
    echo -e "${YELLOW}Configurazione caricata:${NC}"
    echo "   Resource Group: $RESOURCE_GROUP"
    echo ""
else
    echo -e "${YELLOW}File config.sh non trovato.${NC}"
    read -p "Inserisci il nome del Resource Group da eliminare: " RESOURCE_GROUP
fi

# Conferma
echo -e "${RED}ATTENZIONE: Questa operazione eliminerà:${NC}"
echo "   - Resource Group: $RESOURCE_GROUP"
echo "   - Tutte le risorse contenute (Cosmos DB, Functions, Storage, etc.)"
echo ""
read -p "Sei sicuro? (scrivi 'yes' per confermare): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${GREEN}Operazione annullata.${NC}"
    exit 0
fi

echo ""
echo -e "${RED}Eliminazione in corso...${NC}"

# Elimina il resource group (elimina automaticamente tutte le risorse)
az group delete \
    --name $RESOURCE_GROUP \
    --yes \
    --no-wait

echo -e "${GREEN}✓ Comando di eliminazione inviato${NC}"
echo ""
echo -e "${YELLOW}L'eliminazione avviene in background e può richiedere alcuni minuti.${NC}"
echo -e "${YELLOW}   Puoi verificare lo stato nel portale Azure o con:${NC}"
echo -e "${YELLOW}   az group show --name $RESOURCE_GROUP${NC}"
echo ""

# Rimuovi file di configurazione
if [ -f ../config.sh ]; then
    rm ../config.sh
    echo -e "${GREEN}File config.sh rimosso${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Cleanup Completato${NC}"
echo -e "${GREEN}========================================${NC}\n"
