/*
 * Repertório do Louvor da Lagoinha Franca: músicas que já tocamos nos cultos.
 * Aparecem em "Sem ideias? Veja as músicas que já tocamos" ao montar o repertório,
 * junto com as que já foram adicionadas no app (essas trazem artista, tom e link).
 */

/**
 * Quantas vezes cada música foi tocada nos cultos (planilha do Louvor, jan/2025 a out/2026).
 * As mais tocadas aparecem no topo da lista; o que for adicionado no app soma a partir daqui.
 */
export const PLAY_COUNTS: Record<string, number> = {
  'Gratidão': 16, 'Teu amor não falha': 14, 'Que se abram os céus': 11, 'Santo pra sempre': 10, 'Sublime': 10,
  'A boa parte': 8, 'Alfa e Ômega': 8, 'Até que o Senhor venha': 8, 'Senhor, Tu és bom': 8, 'A alegria está no coração': 7,
  'Ainda que a figueira': 7, 'Ele vem': 7, 'Grande é o Senhor': 7, 'Jesus, meu primeiro amor': 7, 'Me derramar': 7,
  'Nada mais': 7, 'Nosso General (é Cristo)': 7, 'Quem é esse': 7, 'Senhor, te quero': 7, 'Te agradeço': 7,
  'Tudo que me prometeu': 7, 'Vitorioso és': 7, 'Vou te alegrar': 7, 'Deus da minha vida': 6, 'Em tua presença': 6,
  'Eu me rendo': 6, 'Eu vou construir': 6, 'Filho do Deus vivo': 6, 'Quando o céu invade a terra': 6, 'Reina em mim': 6,
  'Reina o Senhor': 6, 'Seu sangue': 6, 'A Ele a glória': 5, 'A alegria do Senhor': 5, 'Deixa queimar': 5,
  'Estamos de pé': 5, 'Eu navegarei': 5, 'Eu sou Teu': 5, 'Eu só quero Tua presença': 5, 'Eu vejo a glória': 5,
  'Fogo em teus olhos': 5, 'Isaías 9': 5, 'Primeira essência': 5, 'Tributo a Yehovah': 5, 'Vem, esta é a hora': 5,
  'Yahweh se manifestará': 5, 'Abra os olhos do meu coração': 4, 'Anseio': 4, 'Atos 2': 4, 'Bendito é o Rei': 4,
  'Canção ao Cordeiro': 4, 'Clamo Jesus': 4, 'Digno de tudo': 4, 'Ele reina': 4, 'Ele é exaltado': 4,
  'Escape': 4, 'Espírito, enche a minha vida': 4, 'Eu sou livre': 4, 'Galileu': 4, 'Lugares altos': 4,
  'Maravilhosa graça': 4, 'Meia-noite': 4, 'Ruja o Leão': 4, 'Só Tu és santo': 4, 'Tu és (FHOP)': 4,
  'Yeshua': 4, 'Acende outra vez': 3, 'Ambição': 3, 'Cadeias quebrar': 3, 'Caminho no deserto': 3,
  'Celebrai a Cristo': 3, 'Colossenses e suas linhas de amor': 3, 'Com muito louvor': 3, 'Consagração': 3, 'Em teus braços': 3,
  'Essência da adoração': 3, 'Grandes coisas': 3, 'Leão de Judá': 3, 'Lindo és': 3, 'Majestade santa': 3,
  'Maranata': 3, 'Muralhas': 3, 'No meio dos louvores': 3, 'Oceanos': 3, 'Oh, quão lindo esse nome é': 3,
  'Perto quero estar': 3, 'Poderoso Deus': 3, 'Pra sempre': 3, 'Quebro meu vaso': 3, 'Santo, Santo, Santo': 3,
  'Tudo é perda': 3, 'É Ele': 3, 'A casa é sua': 2, 'A terra clama': 2, 'Aclame ao Senhor': 2,
  'Agnus Dei': 2, 'Além do rio azul': 2, 'Bom perfume': 2, 'Bondade de Deus': 2, 'Carpinteiro': 2,
  'Como prometeste': 2, 'Cristo': 2, 'Diante de Ti': 2, 'Doce presença': 2, 'Em espírito, em verdade': 2,
  'Em seu nome': 2, 'Encontrei aqui': 2, 'Eu te busco': 2, 'Eu tenho um chamado (Um chamado)': 2, 'Firmado na rocha': 2,
  'Fogo que consome': 2, 'Jesus em tua presença': 2, 'Jesus, Filho de Deus': 2, 'Me leva pra casa': 2, 'Meu prazer': 2,
  'Nos braços do Pai': 2, 'Nunca pare de lutar': 2, 'O fogo arderá': 2, 'O que a Tua glória fez comigo': 2, 'Ousado amor': 2,
  'Para que entre o Rei': 2, 'Porque Ele vive': 2, 'Primeiro amor': 2, 'Quebrantado': 2, 'Quero conhecer Jesus': 2,
  'Redentor': 2, 'Santo Espírito': 2, 'Senhor e Rei': 2, 'Sobre as águas': 2, 'Tempo de festa': 2,
  'Teu toque': 2, 'Tu és o Rei': 2, 'Voltemos ao início': 2, 'Águas profundas': 2, 'Águas purificadoras': 2,
  'Único': 2, 'A casa eu arrumei': 1, 'A colheita': 1, 'A resposta': 1, 'Aguardando': 1,
  'Ah, Jesus': 1, 'Algo novo': 1, 'Além do impossível': 1, 'Amigo de Deus': 1, 'Ao Único': 1,
  'Aos pés da cruz': 1, 'Arde outra vez': 1, 'Até que eu não consiga mais ficar de pé': 1, 'Batiza-me': 1, 'Bênçãos que não têm fim': 1,
  'Caminho de milagres': 1, 'Cantarei teu amor': 1, 'Canção do Apocalipse': 1, 'Casa de Deus': 1, 'Coração igual ao teu': 1,
  'Creio que Tu és a cura': 1, 'Cria em mim': 1, 'Deus cuida de mim': 1, 'Deus de milagres': 1, 'Deus me ama': 1,
  'Digno é o Senhor': 1, 'E se eu cair': 1, 'Eis que estou à porta': 1, 'Ele é contigo': 1, 'Em seu poderoso nome': 1,
  'Emanuel': 1, 'Emaús': 1, 'Enquanto eu viver': 1, 'Era eu': 1, 'Eu e minha casa': 1,
  'Eu me rasgo (Santo dos Santos)': 1, 'Eu te louvarei, meu bom Jesus': 1, 'Eu vejo uma pequena nuvem': 1, 'Eu vou seguir com fé': 1, 'Fala comigo': 1,
  'Fiel a mim': 1, 'Geração que dança': 1, 'Labareda de fogo': 1, 'Liberta-me de mim': 1, 'Louve': 1,
  'Louve ao Senhor': 1, 'Lugar secreto': 1, 'Mais de Ti e menos de mim': 1, 'Maravilhoso': 1, 'Me ama': 1,
  'Meu coração é Teu': 1, 'Meu respirar': 1, 'Morada': 1, 'O Grande Eu Sou': 1, 'O Senhor é bom': 1,
  'O fogo nunca dorme': 1, 'O som que desperta': 1, 'Onde o fogo não apaga': 1, 'Os que confiam no Senhor': 1, 'Ouço Deus me chamar': 1,
  'Pedro': 1, 'Perfeito amor': 1, 'Pode morar aqui': 1, 'Poder pra salvar': 1, 'Pra onde iremos': 1,
  'Preciso de Ti': 1, 'Pulsante': 1, 'Quando Ele vem': 1, 'Que Ele cresça': 1, 'Que amor é esse': 1,
  'Quem é como nosso Deus': 1, 'Quero Jesus': 1, 'Quão grande é o meu Deus': 1, 'Reacende a chama': 1, 'Rei do meu coração': 1,
  'Rendido estou': 1, 'Salmo 126': 1, 'Sempre que me olhares': 1, 'Senhor, formoso és': 1, 'Senhor, te amo': 1,
  'Sua presença é real': 1, 'Só quero ver você': 1, 'Só uma coisa me satisfaz': 1, 'Teu santo nome': 1, 'Teus sonhos': 1,
  'Toca em mim de novo': 1, 'Toda sorte de bênçãos': 1, 'Todas as coisas': 1, 'Tu és soberano': 1, 'Tudo é Teu': 1,
  'Tudo é diferente': 1, 'Vem com Josué': 1, 'Vem me buscar': 1, 'Vida aos sepulcros': 1, 'Vitória no deserto': 1,
  'É tudo sobre você': 1, 'És bem-vindo': 1, 'És o amor': 1,
}

/** Artista/versão de referência informado na planilha */
export const ARTISTS: Record<string, string> = {
  'A alegria do Senhor': 'Fernandinho', 'A boa parte': 'FHOP Music', 'A casa eu arrumei': 'Mateus Brito',
  'A colheita': 'Alda Célia', 'A resposta': 'Thalles Roberto', 'Abra os olhos do meu coração': 'David Quinlan',
  'Aclame ao Senhor': 'Diante do Trono', 'Ainda que a figueira': 'Fernandinho', 'Alfa e Ômega': 'Marine Friesen',
  'Algo novo': 'Lukas Agustinho', 'Além do rio azul': 'FHOP Music', 'Ambição': 'Gabi Sampaio',
  'Amigo de Deus': 'Adhemar de Campos', 'Arde outra vez': 'Thalles Roberto', 'Bendito é o Rei': 'FHOP Music',
  'Cadeias quebrar': 'Sarah Oliveira', 'Caminho no deserto': 'Soraya Moraes', 'Canção ao Cordeiro': 'Israel Salazar',
  'Canção do Apocalipse': 'Diante do Trono', 'Carpinteiro': 'Alessandro Vilas Boas', 'Colossenses e suas linhas de amor': 'FHOP Music',
  'Consagração': 'Aline Barros', 'Coração igual ao teu': 'Julliany Souza', 'Creio que Tu és a cura': 'Luciano Claw',
  'Cria em mim': 'Comunidade de Nilópolis', 'Deus da minha vida': 'Thalles Roberto', 'Deus de milagres': 'Soraya Moraes',
  'Diante de Ti': 'Quatro por Um', 'Digno de tudo': 'Fernanda Ferro', 'E se eu cair': 'Eli Soares',
  'Eis que estou à porta': 'Fernandinho', 'Ele reina': 'Jefferson & Suellen', 'Ele vem': 'Gabriel Guedes',
  'Ele é contigo': 'Thalles Roberto', 'Ele é exaltado': 'Gabriel Guedes', 'Em espírito, em verdade': 'Arieta Magrini',
  'Em seu nome': 'André Aquino', 'Em seu poderoso nome': 'Gabriel Guedes', 'Em teus braços': 'Gabriel Guedes',
  'Em tua presença': 'Fernanda Brum', 'Emanuel': 'Fernandinho', 'Enquanto eu viver': 'Diante do Trono',
  'Escape': 'Renascer Praise', 'Espírito, enche a minha vida': 'Quatro por Um', 'Essência da adoração': 'Fernanda Brum',
  'Estamos de pé': 'Marcos Salles', 'Eu e minha casa': 'Julliany Souza', 'Eu sou Teu': 'Gabriela Rocha',
  'Eu sou livre': 'David Quinlan', 'Eu te louvarei, meu bom Jesus': 'Ronaldo Bezerra', 'Eu tenho um chamado (Um chamado)': 'Quatro por Um',
  'Eu vejo a glória': 'Fernanda Brum', 'Eu vou construir': 'Juliano Son', 'Filho do Deus vivo': 'Nívea Soares',
  'Fogo em teus olhos': 'Ruslayra', 'Galileu': 'Fernandinho', 'Geração que dança': 'David Quinlan',
  'Grande é o Senhor': 'Adhemar de Campos', 'Grandes coisas': 'Fernandinho', 'Isaías 9': 'Rodolfo Abrantes',
  'Jesus em tua presença': 'Quatro por Um', 'Jesus, Filho de Deus': 'Fernandinho', 'Louve ao Senhor': 'Renascer Praise',
  'Lugares altos': 'Renascer Praise', 'Majestade santa': 'Alessandro Vilas Boas', 'Maravilhosa graça': 'CG Sede e Guga Xavier',
  'Maravilhoso': 'IBAB', 'Me derramar': 'Vineyard', 'Me leva pra casa': 'Israel Subirá',
  'Meia-noite': 'FHOP Music', 'Muralhas': 'André Valadão', 'Nada mais': 'FHOP Music',
  'Nos braços do Pai': 'Diante do Trono', 'Nosso General (é Cristo)': 'Adhemar de Campos', 'O Grande Eu Sou': 'Daiane Moura e Lukas Agustinho',
  'O som que desperta': 'Julliany Souza', 'Oceanos': 'Ana Paula Nóbrega', 'Oh, quão lindo esse nome é': 'Israel Salazar',
  'Onde o fogo não apaga': 'Damaris Andrade', 'Pedro': 'Felipe Rodrigues', 'Perfeito amor': 'Oficina G3',
  'Perto quero estar': 'Toque no Altar', 'Poderoso Deus': 'David Quinlan', 'Porque Ele vive': 'David Quinlan',
  'Pra onde iremos': 'Gabriela Rocha', 'Pra sempre': 'Avivah', 'Primeira essência': 'Aline Barros',
  'Quando Ele vem': 'André Aquino', 'Que Ele cresça': 'Deigma Marques', 'Que se abram os céus': 'Nívea Soares',
  'Quebrantado': 'Vineyard', 'Quebro meu vaso': 'André Aquino', 'Quem é como nosso Deus': 'Nívea Soares',
  'Quem é esse': 'Julliany Souza', 'Quero conhecer Jesus': 'Alessandro Vilas Boas', 'Redentor': 'Marcelo Markes',
  'Rei do meu coração': 'Nívea Soares', 'Reina em mim': 'Vineyard', 'Reina o Senhor': 'Nívea Soares',
  'Salmo 126': 'Ministério Zoe', 'Santo pra sempre': 'Gabriel Guedes', 'Santo, Santo, Santo': 'Renascer Praise',
  'Senhor, Tu és bom': 'Adoração e Adoradores', 'Senhor, te quero': 'Vineyard', 'Seu sangue': 'Fernandinho',
  'Sublime': 'FHOP Music', 'Só Tu és santo': 'Morada', 'Só quero ver você': 'Juliano Son',
  'Só uma coisa me satisfaz': 'Ministério Zoe', 'Te agradeço': 'Kleber Lucas', 'Tempo de festa': 'Diante do Trono',
  'Teu amor não falha': 'Nívea Soares', 'Teu toque': 'Gabi Sampaio', 'Teus sonhos': 'Fernandinho',
  'Todas as coisas': 'Fernandinho', 'Tributo a Yehovah': 'Paulo César Baruk', 'Tu és (FHOP)': 'FHOP Music',
  'Tudo é diferente': 'Morada', 'Tudo é perda': 'Felipe Rodrigues', 'Vem, esta é a hora': 'Vineyard',
  'Vitorioso és': 'Gabriel Guedes', 'Vitória no deserto': 'Aline Barros', 'Vou te alegrar': 'Aline Barros',
  'Águas purificadoras': 'FHOP Music', 'É tudo sobre você': 'Morada', 'És bem-vindo': 'Israel Salazar',
  'Único': 'FHOP Music',
}

export const REPERTOIRE = [
  // A
  'A alegria do Senhor', 'A alegria está no coração', 'A boa parte', 'A casa é sua', 'A casa eu arrumei', 'A colheita', 'A Ele a glória',
  'A resposta', 'A terra clama', 'Abra os olhos do meu coração', 'Acende outra vez', 'Aclame ao Senhor', 'Agnus Dei', 'Aguardando', 'Algo novo',
  'Águas profundas', 'Águas purificadoras', 'Ah, Jesus', 'Ainda que a figueira', 'Além do impossível', 'Além do rio azul', 'Alfa e Ômega',
  'Ambição', 'Amigo de Deus', 'Anseio', 'Ao Único', 'Aos pés da cruz', 'Arde outra vez', 'Até que eu não consiga mais ficar de pé',
  'Até que o Senhor venha', 'Atos 2',
  // B
  'Batiza-me', 'Bendito é o Rei', 'Bênçãos que não têm fim', 'Bom perfume', 'Bondade de Deus',
  // C
  'Cadeias quebrar', 'Caminho de milagres', 'Caminho no deserto', 'Canção ao Cordeiro', 'Canção do Apocalipse', 'Cantarei teu amor',
  'Carpinteiro', 'Casa de Deus', 'Celebrai a Cristo', 'Clamo Jesus', 'Colossenses e suas linhas de amor', 'Com muito louvor',
  'Como prometeste', 'Consagração', 'Coração igual ao teu', 'Creio que Tu és a cura', 'Cria em mim', 'Cristo',
  // D
  'Deixa queimar', 'Deus cuida de mim', 'Deus da minha vida', 'Deus de milagres', 'Deus me ama', 'Diante de Ti', 'Digno de tudo',
  'Digno é o Senhor', 'Doce presença',
  // E
  'E se eu cair', 'É Ele', 'É tudo sobre você', 'Eis que estou à porta', 'Ele é contigo', 'Ele é exaltado', 'Ele reina', 'Ele vem',
  'Em espírito, em verdade', 'Em seu nome', 'Em seu poderoso nome', 'Em tua presença', 'Em teus braços', 'Emanuel', 'Emaús',
  'Encontrei aqui', 'Enquanto eu viver', 'Era eu', 'És bem-vindo', 'És o amor', 'Escape', 'Espírito, enche a minha vida',
  'Essência da adoração', 'Estamos de pé', 'Eu e minha casa', 'Eu me rasgo (Santo dos Santos)', 'Eu me rendo', 'Eu navegarei',
  'Eu só quero Tua presença', 'Eu sou livre', 'Eu sou Teu', 'Eu te busco', 'Eu te louvarei, meu bom Jesus',
  'Eu tenho um chamado (Um chamado)', 'Eu vejo a glória', 'Eu vejo uma pequena nuvem', 'Eu vou construir', 'Eu vou seguir com fé',
  // F
  'Fala comigo', 'Fiel a mim', 'Filho do Deus vivo', 'Firmado na rocha', 'Fogo em teus olhos', 'Fogo que consome',
  // G
  'Galileu', 'Geração que dança', 'Grande é o Senhor', 'Grandes coisas', 'Gratidão',
  // I / J
  'Isaías 9', 'Jesus em tua presença', 'Jesus, Filho de Deus', 'Jesus, meu primeiro amor',
  // L
  'Labareda de fogo', 'Leão de Judá', 'Liberta-me de mim', 'Lindo és', 'Louve', 'Louve ao Senhor', 'Lugar secreto', 'Lugares altos',
  // M
  'Mais de Ti e menos de mim', 'Majestade santa', 'Maranata', 'Maravilhosa graça', 'Maravilhoso', 'Me ama', 'Me derramar',
  'Me leva pra casa', 'Meia-noite', 'Meu coração é Teu', 'Meu prazer', 'Meu respirar', 'Morada', 'Muralhas',
  // N
  'Nada mais', 'No meio dos louvores', 'Nos braços do Pai', 'Nosso General (é Cristo)', 'Nunca pare de lutar',
  // O
  'O fogo arderá', 'O fogo nunca dorme', 'O Grande Eu Sou', 'O que a Tua glória fez comigo', 'O Senhor é bom', 'O som que desperta',
  'Oceanos', 'Oh, quão lindo esse nome é', 'Onde o fogo não apaga', 'Os que confiam no Senhor', 'Ouço Deus me chamar', 'Ousado amor',
  // P
  'Para que entre o Rei', 'Pedro', 'Perfeito amor', 'Perto quero estar', 'Pode morar aqui', 'Poder pra salvar', 'Poderoso Deus',
  'Porque Ele vive', 'Pra onde iremos', 'Pra sempre', 'Preciso de Ti', 'Primeira essência', 'Primeiro amor', 'Pulsante',
  // Q
  'Quando Ele vem', 'Quando o céu invade a terra', 'Quão grande é o meu Deus', 'Que amor é esse', 'Que Ele cresça',
  'Que se abram os céus', 'Quebrantado', 'Quebro meu vaso', 'Quem é como nosso Deus', 'Quem é esse', 'Quero conhecer Jesus',
  'Quero Jesus',
  // R
  'Reacende a chama', 'Redentor', 'Rei do meu coração', 'Reina em mim', 'Reina o Senhor', 'Rendido estou', 'Ruja o Leão',
  // S
  'Salmo 121', 'Salmo 126', 'Santo Espírito', 'Santo pra sempre', 'Santo, Santo, Santo', 'Sempre que me olhares', 'Senhor e Rei',
  'Senhor, formoso és', 'Senhor, te amo', 'Senhor, te quero', 'Senhor, Tu és bom', 'Seu sangue', 'Só quero ver você',
  'Só Tu és santo', 'Só uma coisa me satisfaz', 'Sobre as águas', 'Sua presença é real', 'Sublime',
  // T
  'Te agradeço', 'Tempo de festa', 'Teu amor não falha', 'Teu santo nome', 'Teu toque', 'Teus sonhos', 'Toca em mim de novo',
  'Toda sorte de bênçãos', 'Todas as coisas', 'Tributo a Yehovah', 'Tu és (FHOP)', 'Tu és o Rei', 'Tu és soberano', 'Tudo é diferente',
  'Tudo é perda', 'Tudo é Teu', 'Tudo que me prometeu',
  // U / V / Y
  'Único', 'Vem com Josué', 'Vem me buscar', 'Vem, esta é a hora', 'Vida aos sepulcros', 'Vitória no deserto', 'Vitorioso és',
  'Voltemos ao início', 'Vou te alegrar', 'Yahweh se manifestará', 'Yeshua',
]

/** Para comparar títulos sem acento, pontuação ou maiúsculas */
export const songKey = (title: string) => title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
