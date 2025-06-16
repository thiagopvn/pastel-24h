const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Inicializa o Admin SDK
admin.initializeApp();

/**
 * Cloud Function para deletar usuário do Firebase Authentication
 * Apenas administradores podem executar esta função
 */
exports.deleteUserAuth = functions.https.onCall(async (data, context) => {
    // Verifica se o usuário está autenticado
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Usuário não autenticado. Faça login para continuar.'
        );
    }

    // Busca os dados do usuário que está fazendo a requisição
    const callerDoc = await admin.firestore()
        .collection('usuarios')
        .doc(context.auth.uid)
        .get();

    if (!callerDoc.exists) {
        throw new functions.https.HttpsError(
            'not-found',
            'Dados do usuário não encontrados.'
        );
    }

    const callerData = callerDoc.data();

    // Verifica se o usuário é administrador
    if (callerData.role !== 'admin') {
    throw new functions.https.HttpsError(
        'permission-denied',
        'Apenas administradores podem excluir usuários.'
    );
}

    // Valida o UID fornecido
    const { uid } = data;
    if (!uid || typeof uid !== 'string') {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'UID do usuário é obrigatório.'
        );
    }

    // Previne auto-exclusão
    if (uid === context.auth.uid) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Você não pode excluir seu próprio usuário.'
        );
    }

    try {
        // Deleta o usuário do Firebase Authentication
        await admin.auth().deleteUser(uid);
        console.log(`Usuário ${uid} deletado do Authentication`);

        // Deleta o documento do usuário no Firestore
        await admin.firestore().collection('usuarios').doc(uid).delete();
        console.log(`Documento do usuário ${uid} deletado do Firestore`);

        return { 
            status: 'ok',
            message: 'Usuário excluído com sucesso'
        };

    } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        
        if (error.code === 'auth/user-not-found') {
            throw new functions.https.HttpsError(
                'not-found',
                'Usuário não encontrado no sistema de autenticação.'
            );
        }

        throw new functions.https.HttpsError(
            'internal',
            'Erro ao excluir usuário. Tente novamente.'
        );
    }
});