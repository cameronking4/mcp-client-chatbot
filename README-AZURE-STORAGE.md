# Azure Storage Integration Guide

This guide explains how to set up and connect your application to Azure Blob Storage for file uploads.

## Prerequisites

1. An active Azure account
2. Sufficient permissions to create and manage Azure Storage resources

## Step 1: Create an Azure Storage Account

1. Sign in to the [Azure Portal](https://portal.azure.com/)
2. Click on "Create a resource" and search for "Storage account"
3. Click "Create" to start the creation process
4. Fill in the required details:
   - **Subscription**: Select your Azure subscription
   - **Resource group**: Create a new one or select an existing one
   - **Storage account name**: Enter a globally unique name (only lowercase letters and numbers, 3-24 characters)
   - **Region**: Select a region close to your users
   - **Performance**: Standard
   - **Redundancy**: Locally-redundant storage (LRS) is sufficient for development
5. Click "Review + create", then "Create"
6. Wait for the deployment to complete

## Step 2: Create a Blob Container

1. Navigate to your new storage account
2. In the left menu, find "Data storage" and click on "Containers"
3. Click "+ Container" to create a new container
4. Name it `project-files` and set the Public access level to "Private"
5. Click "Create"

## Step 3: Get Connection String

1. In your storage account, navigate to "Security + networking" > "Access keys"
2. Look for "Connection string" and click the "Show" button
3. Click the copy button to copy the connection string

## Step 4: Configure Your Application

1. Create or update your `.env` file in the root of your project:

```
AZURE_STORAGE_CONNECTION_STRING=your_connection_string_here
```

2. Make sure to add `.env` to your `.gitignore` to keep your connection string secure

## Step 5: Using Azure Storage in Your Application

Our application uses the `@azure/storage-blob` package to interact with Azure Blob Storage. The implementation is in `src/lib/azure-storage.ts`.

When the connection string is provided in the environment variables, the application will automatically use Azure Blob Storage for file operations. If the connection string is not available, a mock implementation will be used, which stores files in memory.

## Security Considerations

- Never commit your connection string to a public repository
- Consider using Azure Key Vault for storing secrets in production
- Set up proper CORS settings in your Azure Storage account if accessing directly from the browser
- Use SAS tokens with limited permissions and expiration for direct client access

## Troubleshooting

If you encounter issues with Azure Storage:

1. Verify your connection string is correct
2. Check if your container exists with the correct name
3. Ensure your client has the necessary permissions to access the container
4. Look for any CORS issues if accessing directly from the browser
5. Check the application logs for specific error messages

## Additional Resources

- [Azure Blob Storage Documentation](https://docs.microsoft.com/en-us/azure/storage/blobs/)
- [JavaScript SDK for Azure Blob Storage](https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/storage/storage-blob)
- [Azure Storage Explorer](https://azure.microsoft.com/en-us/features/storage-explorer/) (a GUI tool for managing your storage account) 