# Classroom Booking System - Azure Serverless Demo
![Services](./services.png)


## 🎯 Demo Goal

Show how to build a classroom booking web app using:
- **Azure Functions** (serverless compute)
- **Azure Cosmos DB** (managed SQL database)
- **Azure Application Insights** (monitoring)
- **Azure Storage Static Website** (frontend hosting)


## 📋 Prerequisites

- [Azure account (with available credit)](https://portal.azure.com/)
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
- [Node.js](https://nodejs.org/en/download)

## 🚀 Setup


### 1. Check Azure Subscription

```bash
# Sign in to Azure
az login

# List available subscriptions
az account list --output table

# Select the subscription to use (if you have more than one)
az account set --subscription "SUBSCRIPTION_NAME_OR_ID"

```

### 2. Install Azure Functions Core Tools
```bash
# Install Azure Functions Core Tools v4 globally with npm
npm install -g azure-functions-core-tools@4
```

### 3. Create Azure Resources

```bash
# Run the setup script
cd setup
chmod +x create-resources.sh
./create-resources.sh
```

The script creates:
- Resource Group
- Cosmos DB account + database
- Function App with Application Insights
- Azure Blob Storage with frontend deployment

### 4. Deploy the Functions

```bash
# Go back to the project root
cd ..

# Move to the backend/functions folder
cd backend/functions

# Install dependencies
npm install

# Deploy to Azure
func azure functionapp publish <FUNCTION_APP_NAME>
```

## 📁 Project Structure

```markdown
azure-serverless-demo/
├── DevContainer/
├── setup/                          # Azure setup scripts
│   ├── create-resources.sh
│   └── cleanup.sh
├── backend/
│   ├── functions/                  # Azure Functions
│   │   ├── createBooking/
│   │   ├── getBookings/
│   │   ├── deleteBooking/
│   │   └── getAvailableRooms/
│   └── testing/                    # Test scripts
│       └── postman-collection.json # Postman collection for testing
└── frontend/
    ├── index.html                  # App homepage
    ├── script.js                   # JavaScript logic
    └── style.css                   # App stylesheet
```

## 🧹 Resource Cleanup

```bash
cd setup
./cleanup.sh
```

This removes all resources to avoid costs.

## 📚 Additional Resources

- [Azure documentation](https://docs.microsoft.com/azure)
- [Azure for Students](https://azure.microsoft.com/free/students/)
- [Free services list](https://azure.microsoft.com/pricing/free-services/)

