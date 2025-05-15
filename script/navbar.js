document.addEventListener("DOMContentLoaded", function() {
    fetch("../pages/navbar.html")
        .then(response => response.text())
        .then(data => {
            document.querySelector('.navbar').innerHTML = data;

            // Hamburger menu toggle
            const hamburger = document.getElementById('hamburger-menu');
            const menu = document.querySelector('.menu');
            if (hamburger && menu) {
                hamburger.addEventListener('click', function() {
                    menu.classList.toggle('open');
                });
                // Optional: close menu when clicking a link
                menu.querySelectorAll('a').forEach(link => {
                    link.addEventListener('click', () => menu.classList.remove('open'));
                });
            }
        })
        .catch(error => {
            console.error('Error loading navbar:', error);
        });
});
