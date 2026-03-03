const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();   // 👈 PRIMERO se crea

app.use(cors());         // 👈 DESPUÉS se usa
app.use(express.static(__dirname));
const monedas = [
  "USD", "GBP", "JPY", "CHF", "AUD", "CAD", "CNY",
  "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON",
  "TRY", "BRL", "KRW", "INR", "IDR", "MYR", "PHP",
  "SGD", "THB", "NZD",
  "COP",
  "ISK", "RUB", "HKD", "ILS", "MXN", "ZAR"
];
const monedasECB = [
  "USD", "GBP", "JPY", "CHF", "AUD", "CAD", "CNY",
  "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON"
];

let ultimaEUR = {};
// 🔹 Banco de Italia
async function obtenerItalia() {
  const res = await fetch(
    "https://tassidicambio.bancaditalia.it/terzevalute-wf-web/rest/v1.0/latestRates?lang=en",
    {
      headers: {
        "Accept": "application/json"
      }
    }
  );

  const data = await res.json();

  let resultado = {};

  data.latestRates.forEach(r => {
    resultado[r.isoCode] = parseFloat(r.eurRate);
  });

  return resultado;
}
// 🔹 ECB
async function obtenerECB() {

  const lista = monedasECB.join("+");

  const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${lista}.EUR.SP00.A?format=jsondata`;

  const res = await fetch(url);
  const data = await res.json();

  const series = data.dataSets[0].series;
  const structure = data.structure.dimensions.series[1].values;

  let resultado = {};

  Object.keys(series).forEach((key, index) => {
    const moneda = structure[index].id;
    const valores = series[key].observations;
    const ultimo = Object.values(valores).pop()[0];

    resultado[moneda] = ultimo;
  });

  return resultado;
}

// 🔹 FastForex
async function obtenerFF() {
  const res = await fetch(
    "https://api.fastforex.io/fetch-all?api_key=2d924da6ee-5271df6261-tb4nxq"
  );
  const data = await res.json();

  let resultado = {};
  monedas.forEach((m) => {
    resultado[m] = data.results[m] || 0;
  });

  return resultado;
}

// 🔹 margen negocio
function calcularCompraVenta(valor) {
  return {
    compra: valor * 0.98,
    venta: valor * 1.02
  };
}

// 🔹 endpoint
app.get("/api/tasas", async (req, res) => {
  try {
    const ecb = await obtenerECB();
    const ff = await obtenerFF();
    const italia = await obtenerItalia();

    let eur = {};
    let detalleEUR = {};

    monedas.forEach((m) => {
      if (m === "USD") {
        eur[m] = ecb["USD"];
      } else {
        eur[m] = ecb["USD"] * ff[m];
      }
    });

    monedas.forEach((m) => {
      let valor = eur[m] || 0;
      let anterior = ultimaEUR[m] || valor;

      let cambio = valor - anterior;
      let cv = calcularCompraVenta(valor);

      detalleEUR[m] = {
        valor: valor.toFixed(4),
        cambio: cambio.toFixed(4),
        compra: cv.compra.toFixed(2),
        venta: cv.venta.toFixed(2)
      };
    });

    ultimaEUR = eur;

    // 🔥 comparación
    let comparacion = {};

    monedas.forEach((m) => {
      comparacion[m] = {
        central: eur[m]?.toFixed(4) || "0",
        italia: italia[m]?.toFixed(4) || "0",
        diferencia: ((eur[m] || 0) - (italia[m] || 0)).toFixed(4)
      };
    });

    res.json({
      eur,
      detalleEUR, // 👈 IMPORTANTE (lo recuperamos)
      italia,
      comparacion
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});