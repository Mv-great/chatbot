// Importa a classe GoogleGenerativeAI da biblioteca.
// Isso funciona por causa do <script type="importmap"> no HTML.
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

document.addEventListener('DOMContentLoaded', async () => {
    const chatWindow = document.getElementById('chat-window');
    const userInputField = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');

    // URL do backend - alterar para URL do Render em produção
    const backendUrl = "http://localhost:3000";

    // !!! ATENÇÃO !!!
    // !!! NÃO FAÇA ISSO EM PRODUÇÃO !!!
    // SUA API KEY FICARÁ EXPOSTA NO CÓDIGO DO CLIENTE!
    // QUALQUER UM PODERÁ VER E USAR SUA CHAVE, GERANDO CUSTOS.
    // ESTE CÓDIGO É APENAS PARA FINS DEMONSTRATIVOS EM AMBIENTE LOCAL E CONTROLADO.
    const API_KEY = "AIzaSyAzy0sSjCVHM-GJEdF7tH8mMexVx3u_9m0"; // <--- COLOQUE SUA CHAVE AQUI!

    let genAI;
    let chatSession; // Para manter o contexto da conversa com startChat
    let botInteracted = false; // Flag para rastrear se o usuário já interagiu com o bot

    // Função para registrar conexão do usuário
    async function registrarConexaoUsuario() {
        try {
            // Obter informações do usuário (IP) do backend
            const userInfoResponse = await fetch(`${backendUrl}/api/user-info`);
            if (!userInfoResponse.ok) {
                console.error("Falha ao obter informações do usuário:", await userInfoResponse.text());
                return;
            }
            
            const userInfo = await userInfoResponse.json();
            
            // Preparar dados de log
            const logData = {
                ip: userInfo.ip,
                acao: "acesso_inicial_chatbot"
            };
            
            // Enviar log para o backend
            const logResponse = await fetch(`${backendUrl}/api/log-connection`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logData)
            });
            
            if (!logResponse.ok) {
                console.error("Falha ao registrar log de conexão:", await logResponse.text());
            } else {
                const result = await logResponse.json();
                console.log("Log de conexão registrado:", result.message);
            }
        } catch (error) {
            console.error("Erro ao registrar conexão do usuário:", error);
        }
    }
    
    // Função para registrar acesso ao bot para ranking
    async function registrarAcessoBotParaRanking(botId, nomeBot) {
        try {
            const dataRanking = {
                botId: botId,
                nomeBot: nomeBot,
                timestampAcesso: new Date().toISOString()
                // usuarioId: 'pegar_id_do_usuario_se_tiver_login' // Futuramente
            };

            const response = await fetch(`${backendUrl}/api/ranking/registrar-acesso-bot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataRanking)
            });

            if (!response.ok) {
                console.error("Falha ao registrar acesso para ranking:", await response.text());
            } else {
                const result = await response.json();
                console.log("Registro de ranking:", result.message);
            }
        } catch (error) {
            console.error("Erro ao registrar acesso para ranking:", error);
        }
    }

    async function initializeChatbot() {
        if (!API_KEY || API_KEY === "AIzaSyAzy0sSjCVHM-GJEdF7tH8mMexVx3u_9m0") {
            console.error("API Key não configurada no script.js!");
            addMessageToChat("Erro: API Key não configurada. Por favor, edite o arquivo script.js e insira sua chave.", 'bot');
            return false;
        }

        try {
            genAI = new GoogleGenerativeAI(API_KEY);
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash-latest" // Ou "gemini-pro", "gemini-1.5-pro-latest" etc.
            });

            // Configurações de segurança (opcional, mas recomendado)
            // Ajuste conforme necessário para seu caso de uso.
            const safetySettings = [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ];

            chatSession = model.startChat({
                history: [
                    // Você pode adicionar um histórico inicial ou instruções de sistema aqui
                    // Ex: { role: "user", parts: [{ text: "Aja como um pirata divertido." }] },
                    //     { role: "model", parts: [{ text: "Aye, marujo! O que desejas?" }] }
                ],
                generationConfig: {
                    // maxOutputTokens: 200, // Opcional: Limitar o tamanho da resposta
                    // temperature: 0.7, // Opcional: Criatividade da resposta (0.0 a 1.0)
                },
                safetySettings
            });

            console.log("Chatbot Google AI inicializado diretamente no frontend.");
            // Remove a mensagem inicial de "Configure sua API Key" se já existir uma
            const initialBotMessage = chatWindow.querySelector('.bot-message p');
            if (initialBotMessage && initialBotMessage.textContent.includes("Configure sua API Key")) {
                initialBotMessage.parentElement.remove();
                addMessageToChat("Olá! Estou pronto para conversar.", 'bot');
            } else if (chatWindow.children.length === 0 || (chatWindow.children.length === 1 && chatWindow.children[0].classList.contains('bot-message') && chatWindow.children[0].textContent.includes("Configure sua API Key"))) {
                 // Caso a mensagem de configuração tenha sido removida ou seja a única.
                if(chatWindow.children[0] && chatWindow.children[0].textContent.includes("Configure sua API Key")) chatWindow.children[0].remove();
                addMessageToChat("Olá! Estou pronto para conversar.", 'bot');
            }

            userInputField.disabled = false;
            sendButton.disabled = false;
            userInputField.placeholder = "Digite sua mensagem...";
            
            // Registrar conexão do usuário quando o chatbot é inicializado
            await registrarConexaoUsuario();
            
            return true;

        } catch (error) {
            console.error("Erro ao inicializar o chatbot Google AI:", error);
            let errorMessage = `Erro ao inicializar AI: ${error.message}. Verifique o console para mais detalhes.`;
            if (error.message && error.message.includes("API key not valid")) {
                errorMessage = "Erro: A API Key fornecida não é válida. Verifique sua chave no Google AI Studio e no arquivo script.js.";
            } else if (error.message && error.message.includes("quota")) {
                errorMessage = "Erro: Você excedeu sua cota da API. Verifique seu uso no Google Cloud Console ou Google AI Studio.";
            }
            addMessageToChat(errorMessage, 'bot');
            userInputField.disabled = true;
            sendButton.disabled = true;
            userInputField.placeholder = "Chatbot indisponível.";
            return false;
        }
    }

    function addMessageToChat(text, sender, isLoading = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);

        if (isLoading) {
            messageDiv.innerHTML = `
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>`;
            messageDiv.id = 'loading-indicator'; // Para poder remover depois
        } else {
            const p = document.createElement('p');
            p.textContent = text;
            messageDiv.appendChild(p);
        }
        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight; // Auto-scroll para a última mensagem
        return messageDiv;
    }

    async function sendMessage() {
        if (!chatSession) {
            addMessageToChat("Chatbot não está inicializado. Verifique o console.", 'bot');
            return;
        }

        const userText = userInputField.value.trim();
        if (userText === '') return;

        addMessageToChat(userText, 'user');
        userInputField.value = ''; // Limpa o campo de entrada

        const loadingIndicator = addMessageToChat('', 'bot', true); // Mostra "digitando..."

        try {
            // Registrar acesso ao bot para ranking na primeira interação
            if (!botInteracted) {
                await registrarAcessoBotParaRanking("chatbotGeminiIFCODE", "IFCODE Gemini Bot");
                botInteracted = true;
                
                // Registrar ação específica de envio de mensagem
                try {
                    // Obter informações do usuário (IP) do backend
                    const userInfoResponse = await fetch(`${backendUrl}/api/user-info`);
                    if (userInfoResponse.ok) {
                        const userInfo = await userInfoResponse.json();
                        
                        // Preparar dados de log
                        const logData = {
                            ip: userInfo.ip,
                            acao: "enviou_mensagem_chatbot"
                        };
                        
                        // Enviar log para o backend
                        await fetch(`${backendUrl}/api/log-connection`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(logData)
                        });
                    }
                } catch (error) {
                    console.error("Erro ao registrar ação de envio de mensagem:", error);
                }
            }

            // Envia a mensagem para o chat session
            const result = await chatSession.sendMessage(userText);
            const response = result.response;
            const botText = response.text();

            if (loadingIndicator) loadingIndicator.remove(); // Remove o "digitando..."

            if (botText) {
                addMessageToChat(botText, 'bot');
            } else {
                // Isso pode acontecer se o conteúdo for bloqueado por segurança, por exemplo
                let blockReason = "Não recebi uma resposta válida.";
                if (response.promptFeedback && response.promptFeedback.blockReason) {
                    blockReason = `Sua mensagem foi bloqueada. Motivo: ${response.promptFeedback.blockReason}`;
                }
                addMessageToChat(blockReason, 'bot');
            }

        } catch (error) {
            console.error('Erro ao enviar mensagem para Google AI:', error);
            if (loadingIndicator) loadingIndicator.remove();
            let detailedError = error.message || 'Não foi possível obter resposta da IA.';
            if (error.toString().includes("Candidate was blocked due to")) {
                detailedError = "A resposta foi bloqueada por filtros de segurança. Tente uma pergunta diferente.";
            }
            addMessageToChat(`Erro: ${detailedError}`, 'bot');
        }
    }

    sendButton.addEventListener('click', sendMessage);
    userInputField.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    // Inicializa o chatbot quando o DOM estiver carregado
    initializeChatbot();
});
