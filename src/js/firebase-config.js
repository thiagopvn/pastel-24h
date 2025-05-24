// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAFiDHRY_DuJ6pLzDmR-M2bNhzgxsX9doE",
    authDomain: "projetopastel-24h.firebaseapp.com",
    projectId: "projetopastel-24h",
    storageBucket: "projetopastel-24h.firebasestorage.app",
    messagingSenderId: "348495095024",
    appId: "1:348495095024:web:b3e49b8ef1909e4e7ece35",
    measurementId: "G-0D4BNK64Z7"
};

// Inicializar Firebase
try {
    if (typeof firebase !== 'undefined') {
        // Verificar se já existe uma instância
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log("Firebase inicializado com sucesso em firebase-config.js");
        } else {
            console.log("Firebase já havia sido inicializado anteriormente");
        }
    } else {
        console.error("Objeto firebase não está definido. Verifique se os scripts do Firebase foram carregados.");
    }
} catch (error) {
    console.error("Erro ao inicializar Firebase:", error);
}