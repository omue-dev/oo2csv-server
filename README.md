# OO2CSV Server

A lightweight Node.js server that exposes your product and customer data via simple CSV/JSON APIs. Easily integrate it into your workflow or call its endpoints from your frontend or scripts.

## Prerequisites

- **Node.js** v22.11.0 or higher  
- **npm** (comes bundled with Node.js)

## Installation

1. Clone this repository  
```bash
git clone …  
cd oo2csv-server
```

2. Install dependencies

   ```bash
   npm install
   ```

## Running the Server

Start the server with:

```bash
node index.js
```

By default, the server listens on port **3001**. Once it’s running, you’ll see:

```
Server läuft auf http://localhost:3001
```

## API Reference

All endpoints are prefixed with `/api`.
You can optionally pass a `search` query parameter to filter results.

| Method | Endpoint         | Query Params      | Description                                |
| ------ | ---------------- | ----------------- | ------------------------------------------ |
| GET    | `/api/produkte`  | `search` (string) | Retrieve (and optionally search) products  |
| GET    | `/api/customers` | `search` (string) | Retrieve (and optionally search) customers |

### Examples

* **Fetch all customers**

  ```bash
  curl http://localhost:3001/api/customers
  ```
* **Fetch customers matching “Johnson”**

  ```bash
  curl http://localhost:3001/api/customers?search=Johnson
  ```
* **Fetch all products**

  ```bash
  curl http://localhost:3001/api/produkte
  ```
* **Fetch products matching “widget”**

  ```bash
  curl http://localhost:3001/api/produkte?search=widget
  ```

## Dependencies

These packages are declared in `package.json`:

* **express** `^5.1.0`
* **cors** `^2.8.5`
* **csv-parse** `^5.6.0`
* **csv-stringify** `^6.5.2`
* **papaparse** `^5.5.3`
* **xlsx** `^0.18.5`

## Project Structure

```
/
├── data/               # Raw/imported data files  
├── analyse copy.js     # Helper or backup analysis script  
├── customers.js        # CSV parsing/formatting logic for customers  
├── products.js         # CSV parsing/formatting logic for products  
├── index.js            # Entry point & route definitions  
├── package.json        # Dependency list & npm scripts  
├── package-lock.json   # npm lockfile  
└── README.md           # This documentation  
```

## License

This project is released under the [MIT License](LICENSE).

```
```
