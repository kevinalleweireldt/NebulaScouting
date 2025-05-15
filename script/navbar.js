document.addEventListener("DOMContentLoaded", function() {
    fetch("../pages/navbar.html")
        .then(response => response.text())
        .then(data => {
            document.querySelector('.navbar').innerHTML = data;
            // Hamburger menu logic removed
        })
        .catch(error => {
            console.error('Error loading navbar:', error);
        });
});
