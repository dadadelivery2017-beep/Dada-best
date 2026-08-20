// גלילה חלקה לקישורים באתר

document.querySelectorAll('a[href^="#"]').forEach(link => {

    link.addEventListener('click', function(event) {

        const target = document.querySelector(
            this.getAttribute('href')
        );

        if (target) {
            event.preventDefault();

            target.scrollIntoView({
                behavior: 'smooth'
            });
        }

    });

});


// הודעה כאשר שולחים את טופס הצעת המחיר

const form = document.querySelector('form');

if (form) {

    const button = form.querySelector('button');

    button.addEventListener('click', function() {

        const name = form.querySelector('input[type="text"]').value;
        const phone = form.querySelector('input[type="tel"]').value;

        if (!name || !phone) {

            alert('נא למלא שם ומספר טלפון');

            return;
        }

        alert(
            'תודה ' + name +
            '! קיבלנו את הבקשה שלך ונחזור אליך בהקדם.'
        );

    });

}
