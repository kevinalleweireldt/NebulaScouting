document.addEventListener("DOMContentLoaded", function() {
    fetch("../navbar.html")
        .then(response => response.text())
        .then(data => {
            document.querySelector('.navbar').innerHTML = data;
        })
        .catch(error => {
            console.error('Error loading navbar:', error);
        });
    });
