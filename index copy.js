const express = require("express");
const puppeteer = require("puppeteer");
const fs = require("fs").promises;

async function carregarDadosJSON() {
  try {
    const dados = await fs.readFile("./data.json", "utf-8");
    return JSON.parse(dados);
  } catch (error) {
    console.error("Erro ao ler o arquivo JSON:", error);
    return [];
  }
}
const app = express();
const port = 3000;

// Adicione esta linha
app.use(express.static("public"));

async function scrapeTableData(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "networkidle0" });

  const dataTable = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("table tr"));
    return rows.map((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      return cells.map((cell) => cell.innerText);
    });
  });

  // Extrai os valores específicos antes dos <span class="css-1gs4hel">
  const valoresEspecificos = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll("span"));
    let valores = [];

    spans.forEach((span) => {
      const clone = span.cloneNode(true);
      const childSpan = clone.querySelector(".css-1gs4hel");
      if (childSpan) {
        childSpan.remove();
        valores.push(clone.textContent.trim());
      }
    });

    // Retorna os dois primeiros valores encontrados ou valores vazios se não encontrados
    return valores.slice(0, 2);
  });

  await browser.close();
  return { dataTable, valoresEspecificos };
}

app.get("/data", async (req, res) => {
  try {
    const url = "https://pnix.exchange/nightcrows/"; // URL para scraping
    const data = await scrapeTableData(url);
    res.json(data);
  } catch (error) {
    console.error("Erro ao raspar dados:", error);
    res.status(500).send("Erro interno do servidor");
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
