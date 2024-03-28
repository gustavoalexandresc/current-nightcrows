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

app.get("/obter-dados", async (req, res) => {
  try {
    const dados = await fs.readFile("./data.json", "utf8");
    res.json(JSON.parse(dados));
  } catch (error) {
    console.error("Erro ao ler o arquivo JSON:", error);
    res.status(500).send("Erro interno do servidor");
  }
});

app.get("/data", async (req, res) => {
  try {
    const url = "https://pnix.exchange/nightcrows/";
    const { dataTable, valoresEspecificos } = await scrapeTableData(url);
    let objetosJSON = await carregarDadosJSON();

    // Começa do índice 1 para pular a primeira linha vazia dos dados
    dataTable.slice(1).forEach((row) => {
      if (row.length > 0) {
        // Supondo que queremos dividir os dados combinados em colunas separadas
        const splitFirstColumn = row[1].split("\n"); // Divide o nome e o par
        const splitVolume = row[2].split("\n"); // Divide o volume de CROW e o valor em dólar
        const variation = row[3];
        const splitTotalVolume = row[4].split("\n"); // Divide o volume total de CROW e o valor total em dólar
        const splitTotalValue = row[5].split("\n"); // Divide o valor total em dólar e a quantidade
        const idFromCurrency = splitFirstColumn[1].substring(0, 3);
        const valorCrow = splitVolume[0];
        const valorDol = splitVolume[1];
        const volCrow = splitTotalVolume[0];
        const volDolar = splitTotalVolume[1];
        const marketDolar = splitTotalValue[0];
        const marketQtd = splitTotalValue[1];

        objetosJSON.forEach((obj) => {
          if (idFromCurrency === obj.id) {
            obj.precoCrow = converterParaNumero(valorCrow);
            obj.precoDolar = converterParaNumero(valorDol);
            obj.change = variation;
            obj.volCrow = volCrow;
            obj.volDolar = volDolar;
            obj.totalVendidoDolar = marketDolar;
            obj.totalVendidoQtd = marketQtd;
          }
        });
      }
    });
    valoresEspecificos;
    objetosJSON.forEach((obj) => {
      if ("CROW" === obj.id) {
        obj.precoDolar = converterParaNumero(valoresEspecificos[0]);
        obj.volCrow = `${valoresEspecificos[1]}$`;
      }
    });
    // Opção 1: Salvar os dados atualizados de volta ao arquivo JSON
    await fs.writeFile("./data.json", JSON.stringify(objetosJSON, null, 2));

    // Opção 2: Enviar os dados atualizados na resposta (sem salvar no arquivo)
    res.json(objetosJSON);

    console.log("Dados atualizados com sucesso!");
    //res.send("Dados atualizados com sucesso!");
  } catch (error) {
    console.error("Erro ao processar os dados:", error);
    res.status(500).send("Erro interno do servidor");
  }
});

app.use(express.json()); // Para parsear o corpo das requisições POST como JSON

app.post("/atualizar-json", async (req, res) => {
  const atualizacoes = req.body; // Objeto com os IDs e os novos valores

  try {
    const caminhoArquivoJson = "./data.json";
    const dados = await fs.readFile(caminhoArquivoJson, "utf-8");
    let json = JSON.parse(dados);

    // Itera sobre o objeto de atualizações recebido
    Object.entries(atualizacoes).forEach(([id, valor]) => {
      // Encontra o objeto no array JSON pelo id e atualiza as propriedades
      const item = json.find((item) => item.id === id);
      if (item) {
        if (item.id == "CROW") {
          item.minhasCrow = converterParaNumero(valor); // Atualiza precoGame
        } else {
          item.precoGame = converterParaNumero(valor); // Atualiza precoGame
        }
      }
    });

    await fs.writeFile(caminhoArquivoJson, JSON.stringify(json, null, 2));
    res.json({ sucesso: true, json: json });
  } catch (error) {
    console.error("Erro ao atualizar o JSON:", error);
    res
      .status(500)
      .send({ sucesso: false, mensagem: "Erro interno do servidor." });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});

function converterParaNumero(valorStr) {
  // Remove caracteres não numéricos exceto '.' e ','
  let numStr = valorStr.replace(/[^\d.,]/g, "");

  // Trata vírgulas como separadores decimais, substituindo por ponto
  numStr = numStr.replace(/,/g, ".");

  // Verifica se o valor inclui o sufixo 'K' para milhares
  const temMilhares = numStr.toUpperCase().includes("K");
  if (temMilhares) {
    numStr = numStr.replace(/K/gi, ""); // Remove o 'K'
    return parseFloat(numStr) * 1000; // Converte para número e ajusta para milhares
  }

  // Converte o valor limpo para número
  return parseFloat(numStr);
}
