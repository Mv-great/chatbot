// Importar dependências
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// Configuração do servidor Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Array para simulação do ranking
let dadosRankingVitrine = [];

// Conexão com MongoDB
let db;

async function connectDB() {
    try {
        // Modificando as opções de conexão para resolver o problema de SSL
        const client = new MongoClient(process.env.MONGO_URI, {
            ssl: true,
            tls: true,
            tlsAllowInvalidCertificates: true,
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        await client.connect();
        console.log('Conectado ao MongoDB Atlas!');
        db = client.db("IIW2023A_Logs"); // Nome do banco de dados no cluster compartilhado
        return true;
    } catch (error) {
        console.error('Erro ao conectar ao MongoDB:', error);
        return false;
    }
}

// Rota de teste
app.get('/', (req, res) => {
    res.json({ message: 'API do Chatbot funcionando!' });
});

// Endpoint para obter informações do usuário
app.get('/api/user-info', (req, res) => {
    // Obter o IP do cliente
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    res.json({
        ip: ip,
        timestamp: new Date().toISOString()
    });
});

// Endpoint para registrar logs de conexão
app.post('/api/log-connection', async (req, res) => {
    if (!db) {
        return res.status(500).json({ error: "Conexão com o banco de dados não estabelecida." });
    }

    const { ip, acao } = req.body;

    if (!ip || !acao) {
        return res.status(400).json({ error: "Dados de log incompletos (IP e ação são obrigatórios)." });
    }

    const agora = new Date();
    const dataFormatada = agora.toISOString().split('T')[0]; // YYYY-MM-DD
    const horaFormatada = agora.toTimeString().split(' ')[0]; // HH:MM:SS

    const logEntry = {
        col_data: dataFormatada,
        col_hora: horaFormatada,
        col_IP: ip,
        col_acao: acao
    };

    try {
        const collection = db.collection("tb_cl_user_log_acess");
        const result = await collection.insertOne(logEntry);
        console.log(`[Servidor] Log registrado: ${JSON.stringify(logEntry)}`);
        res.status(201).json({ message: "Log de conexão registrado com sucesso", id: result.insertedId });
    } catch (error) {
        console.error('Erro ao salvar log:', error);
        res.status(500).json({ error: "Falha ao registrar log de conexão." });
    }
});

// Endpoint para registrar acesso ao bot para ranking
app.post('/api/ranking/registrar-acesso-bot', (req, res) => {
    const { botId, nomeBot, timestampAcesso, usuarioId } = req.body;

    if (!botId || !nomeBot) {
        return res.status(400).json({ error: "ID e Nome do Bot são obrigatórios para o ranking." });
    }

    const acesso = {
        botId,
        nomeBot,
        usuarioId: usuarioId || 'anonimo',
        acessoEm: timestampAcesso ? new Date(timestampAcesso) : new Date(),
        contagem: 1
    };

    // Lógica para o ranking: adicionar ao array ou incrementar contagem
    const botExistente = dadosRankingVitrine.find(b => b.botId === botId);
    if (botExistente) {
        botExistente.contagem += 1;
        botExistente.ultimoAcesso = acesso.acessoEm;
    } else {
        dadosRankingVitrine.push({
            botId: botId,
            nomeBot: nomeBot,
            contagem: 1,
            ultimoAcesso: acesso.acessoEm
        });
    }
    
    console.log('[Servidor] Dados de ranking atualizados:', dadosRankingVitrine);
    res.status(201).json({ message: `Acesso ao bot ${nomeBot} registrado para ranking.` });
});

// Endpoint para visualizar o ranking
app.get('/api/ranking/visualizar', (req, res) => {
    // Ordenar por contagem, do maior para o menor
    const rankingOrdenado = [...dadosRankingVitrine].sort((a, b) => b.contagem - a.contagem);
    res.json(rankingOrdenado);
});

// Iniciar o servidor
async function startServer() {
    const isConnected = await connectDB();
    if (isConnected) {
        app.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
        });
    } else {
        console.error('Não foi possível iniciar o servidor devido a falha na conexão com o MongoDB.');
        // Iniciar o servidor mesmo sem conexão com MongoDB para testes
        console.log('Iniciando servidor sem conexão com MongoDB para testes...');
        app.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT} (modo de teste - sem MongoDB)`);
        });
    }
}

startServer();
