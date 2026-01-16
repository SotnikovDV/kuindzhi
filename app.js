const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3400;

// Поддерживаем оба варианта имени переменной (исторически в примере было VITE_PERPLEXITY_API_KEY)
const PERPLEXITY_API_KEY =
    process.env.PERPLEXITY_API_KEY ||
    process.env.VITE_PERPLEXITY_API_KEY ||
    '';
const PERPLEXITY_KEY_SOURCE =
    process.env.PERPLEXITY_API_KEY ? 'PERPLEXITY_API_KEY' :
    process.env.VITE_PERPLEXITY_API_KEY ? 'VITE_PERPLEXITY_API_KEY' :
    'не задан';

// Настройка EJS как шаблонизатора
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Статические файлы (CSS, JS, изображения)
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint для получения списка картин из галереи
app.get('/api/gallery', (req, res) => {
    try {
        const galleryPath = path.join(__dirname, 'public', 'gallary');
        const files = fs.readdirSync(galleryPath);
        
        // Фильтруем только изображения и исключаем "1880 - Лунная ночь на Днепре"
        const images = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
            })
            .filter(file => !file.includes('1880 - Лунная ночь на Днепре'))
            .map(file => ({
                filename: file,
                name: path.parse(file).name,
                path: `/gallary/${file}`
            }))
            // Сортируем по имени файла (с учетом чисел в префиксе года)
            .sort((a, b) => a.filename.localeCompare(b.filename, 'ru', { numeric: true, sensitivity: 'base' }));
        
        res.json(images);
    } catch (error) {
        console.error('Ошибка при чтении галереи:', error);
        res.status(500).json({ error: 'Не удалось загрузить галерею' });
    }
});

// Главная страница
app.get('/', (req, res) => {
    res.render('index', {
        perplexityApiKey: PERPLEXITY_API_KEY
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 Откройте браузер и перейдите по адресу выше`);
    console.log(`🤖 Perplexity API key: ${PERPLEXITY_API_KEY ? 'загружен' : 'НЕ ЗАДАН'} (источник: ${PERPLEXITY_KEY_SOURCE})`);
});

