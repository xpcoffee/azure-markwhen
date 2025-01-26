# Azure MarkWhen CLI

> Warning: This project was created mainly using GitHub Copilot. The model version used is GPT-4.

This project is a TypeScript CLI tool that fetches information about Azure DevOps work items and outputs them in MarkWhen format. The tool is designed to transform work items into MarkWhen entries, making it easier to visualize and manage work items.

## Features

- Fetches Azure DevOps work items using the current Azure CLI credentials.
- Transforms work items into MarkWhen format.
- Supports hierarchical work items (Features, User Stories, Tasks).
- Skips work items that have a closed status.
- Persists authentication between script runs and re-authenticates if an authentication issue occurs.

## Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/your-username/azure-markwhen.git
   cd azure-markwhen
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

## Usage

To use the CLI tool, run the following command:
```sh
npm run start <organization> <work-item-id>
```

Replace `<organization>` with your Azure DevOps organization name and `<work-item-id>` with the ID of the root work item you want to fetch.

## Example

```sh
npm run start my-organization 12345
```

## License

This project is licensed under the MIT License.
