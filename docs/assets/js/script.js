(function () {
    "use strict";

    try {
        window.addEventListener('load', function () {
            var preloader = document.getElementById('preloader');
            preloader.classList.add('d-none');
        });
    } catch (err) { }

    const searchTogglers = document.querySelectorAll(".search-toggler");
    if (searchTogglers.length > 0) {
        searchTogglers.forEach((searchToggler) => {
            searchToggler.addEventListener("click", function (e) {
                e.preventDefault();

                const searchPopup = document.querySelector(".search-popup");
                if (searchPopup) {
                    searchPopup.classList.toggle("active");
                }

                // const mobileNavWrapper = document.querySelector(".mobile-nav-wrapper");
                // if (mobileNavWrapper) {
                //     mobileNavWrapper.classList.remove("expanded");
                // }
            });
        });
    }

    // Header is loaded right away (not after all images) so the menu shows up immediately.
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (headerPlaceholder && !document.getElementById('navbar')) {
        fetch('components/header.html?v=3')
            .then(response => response.text())
            .then(data => {
                if (document.getElementById('navbar')) return;
                headerPlaceholder.insertAdjacentHTML('afterend', data);
                initAllFeatures(); // Initialize everything AFTER header loads
            })
            .catch(error => console.error('Error loading header:', error));
    }

    function initAllFeatures() {
        // 1. Initialize sticky header
        initStickyHeader();

        // 2. Initialize go-top button
        initGoTopButton();

        // 3. Initialize counter animation
        initCounterAnimation();

        // 4. Initialize plus/minus widgets
        initPlusMinusWidgets();
    }

    function initStickyHeader() {
        const navbar = document.getElementById("navbar");
        if (!navbar) {
            console.log('Navbar element not found');
            return;
        }

        let lastScrollTop = 0;
        window.addEventListener("scroll", () => {
            requestAnimationFrame(() => {
                const scrollTop = window.scrollY || document.documentElement.scrollTop;
                if (scrollTop >= 100 && lastScrollTop < 100) {
                    navbar.classList.add("sticky");
                } else if (scrollTop < 100 && lastScrollTop >= 100) {
                    navbar.classList.remove("sticky");
                }
                lastScrollTop = scrollTop;
            });
        });
    }

    function initGoTopButton() {
        try {
            const goTopButton = document.querySelector('.go-top');
            if (!goTopButton) return;

            window.addEventListener('scroll', function () {
                goTopButton.classList.toggle('active', window.scrollY > 600);
            });

            goTopButton.addEventListener('click', function () {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        } catch (err) {
            console.error('Go-top button error:', err);
        }
    }

    function initCounterAnimation() {
        try {
            if ("IntersectionObserver" in window) {
                const counterObserver = new IntersectionObserver(function (entries) {
                    entries.forEach(function (entry) {
                        if (entry.isIntersecting) {
                            animateCounter(entry.target);
                            counterObserver.unobserve(entry.target);
                        }
                    });
                });

                document.querySelectorAll(".counter").forEach(counter => {
                    counterObserver.observe(counter);
                });
            }
        } catch (err) {
            console.error('Counter animation error:', err);
        }
    }

    function animateCounter(counter) {
        const target = parseInt(counter.innerText);
        const duration = 2000; // 2 seconds
        const startTime = performance.now();

        function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            counter.innerText = Math.floor(progress * target);

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        }

        requestAnimationFrame(updateCounter);
    }

    function initPlusMinusWidgets() {
        try {
            const resultEl = document.querySelector(".resultSet");
            if (!resultEl) return;

            document.querySelectorAll(".add-to-cart-counter").forEach(widget => {
                widget.querySelector(".minusBtn")?.addEventListener("click", () => adjustCount(widget, -1));
                widget.querySelector(".plusBtn")?.addEventListener("click", () => adjustCount(widget, 1));
                widget.querySelector(".count")?.addEventListener("change", updateTotal);
            });

            function adjustCount(widget, delta) {
                const countEl = widget.querySelector(".count");
                countEl.value = Math.max(0, Number(countEl.value) + delta);
                countEl.dispatchEvent(new Event('change'));
            }

            function updateTotal() {
                resultEl.value = Array.from(document.querySelectorAll(".add-to-cart-counter .count"))
                    .reduce((sum, el) => sum + Number(el.value), 0);
            }
        } catch (err) {
            console.error('Plus/minus widgets error:', err);
        }
    }

    // Mobile menu: listen on the document so it works no matter when
    // components/mobile_navbar.html finishes loading (it is fetched separately
    // from the header, so binding to the items directly could miss them).
    document.addEventListener('click', function (e) {
        const link = e.target.closest('.mobile-menu > .mobile-menu-list > a');
        if (!link) return;
        const item = link.parentElement;
        if (!item.querySelector('.mobile-menu-items')) return; // plain link, let it navigate

        e.preventDefault();
        const wasActive = item.classList.contains('active');
        item.parentElement.querySelectorAll(':scope > .mobile-menu-list').forEach(i => i.classList.remove('active'));
        if (!wasActive) item.classList.add('active');
    });

    var swiper = new Swiper(".partner-slide", {
        slidesPerView: "auto", // Allows smooth infinite scrolling
        spaceBetween: 100,
        loop: true,
        speed: 3000, // Slow, continuous speed
        autoplay: {
            delay: 0, // No delay between transitions
            disableOnInteraction: false // Keep autoplay running even when user interacts
        },
        allowTouchMove: false, // Prevents manual swiping to ensure smooth effect
        freeMode: true, // Enables free movement for a seamless experience
        freeModeMomentum: false, // Disables momentum stopping effect
        breakpoints: {
            0: {
                slidesPerView: 2,
                spaceBetween: 30
            },
            576: {
                slidesPerView: 2,
                spaceBetween: 50
            },
            768: {
                slidesPerView: 3,
                spaceBetween: 50
            },
            992: {
                slidesPerView: 4,
                spaceBetween: 70
            },
            1200: {
                slidesPerView: 5
            }
        }
    });



    // Partner Two Slider JS
    var swiper = new Swiper(".partner-two-slide", {
        slidesPerView: 1,
        spaceBetween: 100,
        loop: true,
        speed: 1000,
        breakpoints: {
            0: {
                slidesPerView: 2,
                spaceBetween: 30
            },
            576: {
                slidesPerView: 2,
                spaceBetween: 50
            },
            768: {
                slidesPerView: 3,
                spaceBetween: 50
            },
            992: {
                slidesPerView: 4,
                spaceBetween: 70
            },
            1200: {
                slidesPerView: 6,
                spaceBetween: 70
            },
            1400: {
                slidesPerView: 6,
                spaceBetween: 70
            },
            1600: {
                slidesPerView: 6
            }
        }
    });

    // Services Slider JS
    var swiper = new Swiper(".services-slide", {
        slidesPerView: 1,
        spaceBetween: 25,
        loop: true,
        speed: 1000,
        navigation: {
            nextEl: ".swiper-button-next",
            prevEl: ".swiper-button-prev",
        },
        breakpoints: {
            0: {
                slidesPerView: 1
            },
            576: {
                slidesPerView: 1
            },
            768: {
                slidesPerView: 2
            },
            992: {
                slidesPerView: 2
            },
            1200: {
                slidesPerView: 2
            },
            1400: {
                slidesPerView: 2
            },
            1600: {
                slidesPerView: 3
            }
        }
    });

    // Choose Us Slider JS
    var swiper = new Swiper(".choose-slide", {
        slidesPerView: 1,
        spaceBetween: 0,
        loop: true,
        speed: 1500,
        pagination: {
            el: ".choose-pagination",
            clickable: true,
        },
    });

    // Testimonial Slider JS
    var swiper = new Swiper(".testimonial-slide", {
        slidesPerView: 1,
        spaceBetween: 20,
        loop: true,
        speed: 1500,
        pagination: {
            el: ".testimonial-pagination",
            clickable: true,
        },
    });

    // scrollCue
    scrollCue.init({
        interval: -1, // Triggers animations earlier
        duration: 600,  // Animation duration in ms
        once: false     // Re-animate elements on scroll
    });


})();

