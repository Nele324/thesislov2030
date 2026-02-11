# thesislov2030 - Master Thesis Website

This is a React website built with Node.js and TypeScript for a master thesis project.

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app) and includes TypeScript support.

## Prerequisites

- Node.js (v24.13.0 or higher)
- npm (v11.6.2 or higher)
- Visual Studio Code (recommended)

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/Nele324/thesislov2030.git
   cd thesislov2030
   ```

2. **Install dependencies (Required before first run):**
   ```bash
   npm install
   ```
   > ⚠️ **Important**: You must run `npm install` before running any other commands. This installs all required dependencies including `react-scripts`.

3. Start the development server:
   ```bash
   npm start
   ```

## Development in Visual Studio Code

This project includes VS Code configuration files in the `.vscode` directory:
- **settings.json**: Editor settings for code formatting and TypeScript support
- **extensions.json**: Recommended extensions (ESLint, Prettier, TypeScript)
- **launch.json**: Chrome debugger configuration
- **tasks.json**: Build and test task definitions

### Recommended Extensions
- ESLint (dbaeumer.vscode-eslint)
- Prettier (esbenp.prettier-vscode)
- TypeScript (ms-vscode.vscode-typescript-next)

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Troubleshooting

### Error: 'react-scripts' is not recognized

If you get the error `'react-scripts' is not recognized as an internal or external command`, it means you haven't installed the project dependencies yet.

**Solution**: Run `npm install` in the project directory before running `npm start`.

```bash
npm install
npm start
```

### Common Issues

- **Missing node_modules folder**: Run `npm install` to install dependencies
- **Port 3000 already in use**: Either stop the other process using port 3000 or the development server will prompt you to use a different port
- **Build errors**: Try deleting `node_modules` and `package-lock.json`, then run `npm install` again

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
