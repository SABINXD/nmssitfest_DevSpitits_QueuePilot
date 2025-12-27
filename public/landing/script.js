let currentUser = null;
let reviewInterval;
let currentReviewIndex = 0;
let allReviews = [];
let selectedPlan = '';
let selectedPrice = 0;
let maxFaceIds = 3;
let cameraStream = null;
let registeredFaces = [];

const userIcon = document.getElementById('userIcon');
const loginModal = document.getElementById('loginModal');
const loginClose = document.getElementById('loginClose');
const userProfile = document.getElementById('userProfile');
const userAvatar = document.getElementById('userAvatar');
const userDropdown = document.getElementById('userDropdown');
const userName = document.getElementById('userName');
const emailLoginBtn = document.getElementById('emailLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const emailInput = document.getElementById('emailInput');
const reviewFormArea = document.getElementById('reviewFormArea');
const loginPromptBtn = document.getElementById('loginPromptBtn');
const reviewsSlider = document.getElementById('reviewsSlider');
const reviewDots = document.getElementById('reviewDots');
const paymentModal = document.getElementById('paymentModal');
const verificationModal = document.getElementById('verificationModal');

function initializeApp() {
    loadUserFromMemory();
    loadReviewsFromMemory();
    initializeGoogleSignIn();
    setupEventListeners();
    startReviewRotation();
    animateStats();
    loadPurchasedPlan();
    loadRegisteredFaces();
}

function loadPurchasedPlan() {
    const purchased = localStorage.getItem('queuepilot_purchased_plan');
    if (purchased) {
        try {
            const planData = JSON.parse(purchased);
            updatePricingButtons(planData.plan);
        } catch (e) {
            console.error('Error loading purchased plan:', e);
        }
    }
}

function loadRegisteredFaces() {
    const saved = localStorage.getItem('queuepilot_faces');
    if (saved) {
        registeredFaces = JSON.parse(saved);
    }
}

function saveRegisteredFaces() {
    localStorage.setItem('queuepilot_faces', JSON.stringify(registeredFaces));
}

function updatePricingButtons(currentPlan) {
    const pricingCards = document.querySelectorAll('.pricing-card');
    pricingCards.forEach(card => {
        const btn = card.querySelector('.pricing-btn');
        const planName = card.querySelector('.pricing-name').textContent;
        
        if (planName === currentPlan) {
            btn.textContent = 'Current Plan';
            btn.style.background = '#6b7280';
            btn.style.cursor = 'not-allowed';
            btn.onclick = function(e) {
                e.preventDefault();
                return false;
            };
        } else {
            const planOrder = { 'Basic': 1, 'Standard': 2, 'Ultimate': 3 };
            const currentOrder = planOrder[currentPlan] || 0;
            const thisOrder = planOrder[planName] || 0;
            
            if (thisOrder > currentOrder) {
                btn.textContent = 'Upgrade';
            } else {
                btn.textContent = 'Downgrade';
            }
        }
    });
}

function openPaymentModal(plan, price, faceLimit) {
    const purchased = localStorage.getItem('queuepilot_purchased_plan');
    if (purchased) {
        const planData = JSON.parse(purchased);
        if (planData.plan === plan) {
            return;
        }
    }

    selectedPlan = plan;
    selectedPrice = price;
    maxFaceIds = faceLimit;
    document.getElementById('selectedPlan').textContent = plan + ' Plan';
    document.getElementById('selectedPrice').textContent = price;
    paymentModal.classList.add('active');
}

function closePaymentModal() {
    paymentModal.classList.remove('active');
    document.getElementById('paymentForm').reset();
    document.getElementById('fileName').textContent = '';
    document.getElementById('documentPreview').style.display = 'none';
    document.getElementById('otherCompanyGroup').classList.remove('show');
}

function processPayment(method) {
    const form = document.getElementById('paymentForm');
    if (!form) {
        console.error('Form not found');
        return;
    }
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const customerName = document.getElementById('customerName').value;
    const mpin = document.getElementById('mpin').value;
    const panNumber = document.getElementById('panNumber').value;
    const companyType = document.getElementById('companyType').value;
    const companySize = document.getElementById('companySize').value;
    const companyDoc = document.getElementById('companyDoc').files[0];

    if (!companyDoc) {
        alert('Please upload company verification document');
        return;
    }

    console.log('Processing payment with', method);

    const paymentFormArea = document.getElementById('paymentFormArea');
    paymentFormArea.innerHTML = `
        <div class="payment-header-section">
            <div class="payment-header">Processing Payment</div>
            <div class="payment-subtitle">Please wait...</div>
        </div>
        <div class="payment-body">
            <div class="processing-screen">
                <div class="processing-spinner"></div>
                <div class="processing-text">Processing Payment</div>
                <div class="processing-subtext">Please wait while we process your ${method} payment...</div>
            </div>
        </div>
    `;

    setTimeout(() => {
        console.log('Payment processed, showing success');
        showPaymentSuccess();
    }, 3000);
}

function showPaymentSuccess() {
    const paymentFormArea = document.getElementById('paymentFormArea');
    if (!paymentFormArea) {
        console.error('Payment form area not found');
        return;
    }
    
    paymentFormArea.innerHTML = `
        <div class="payment-header-section">
            <button class="payment-close-btn" onclick="closePaymentModal()">
                <i class="ri-close-line" style="font-size: 20px;"></i>
            </button>
            <div class="payment-header">Payment Status</div>
            <div class="payment-subtitle">Transaction completed successfully</div>
        </div>
        <div class="payment-body">
            <div class="success-screen">
                <div class="success-icon">
                    <i class="ri-check-line"></i>
                </div>
                <div class="success-title">Payment Successful!</div>
                <div class="success-message">Your payment has been processed successfully. Please complete the face verification to access your dashboard.</div>
                <button class="btn btn-primary" onclick="startVerification()">
                    Start Admin Verification
                    <i class="ri-arrow-right-line"></i>
                </button>
            </div>
        </div>
    `;
    
    console.log('Payment success screen displayed');
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            } 
        });
        const videoElement = document.getElementById('cameraFeed');
        if (videoElement) {
            videoElement.srcObject = stream;
            cameraStream = stream;
            console.log('Camera started successfully');
        }
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Unable to access camera. Please ensure camera permissions are granted.');
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

function captureAndSaveFace() {
    const video = document.getElementById('cameraFeed');
    const canvas = document.getElementById('cameraCanvas');
    
    if (!video || !canvas) {
        console.error('Video or canvas element not found');
        return;
    }

    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const faceImage = canvas.toDataURL('image/jpeg');
    registeredFaces.push({
        id: Date.now(),
        image: faceImage,
        timestamp: new Date().toISOString()
    });
    saveRegisteredFaces();
    
    stopCamera();
    showVerificationSuccess();
}

function startVerification() {
    console.log('Starting verification...');
    const modal = document.getElementById('paymentModal');
    const verModal = document.getElementById('verificationModal');
    
    if (!modal || !verModal) {
        console.error('Modals not found', { modal, verModal });
        return;
    }
    
    modal.classList.remove('active');
    
    setTimeout(() => {
        verModal.classList.add('active');
        console.log('Verification modal opened');
        
        startCamera();
        
        let step = 0;
        const instructions = [
            'Look straight ahead',
            'Turn your face left',
            'Turn your face right'
        ];
        
        const instructionElement = document.getElementById('verificationInstruction');
        const stepElements = document.querySelectorAll('.verification-step');
        
        if (!instructionElement || stepElements.length === 0) {
            console.error('Verification elements not found');
            return;
        }
        
        instructionElement.textContent = instructions[0];
        stepElements[0].classList.add('active');
        
        const interval = setInterval(() => {
            step++;
            if (step < 3) {
                instructionElement.textContent = instructions[step];
                stepElements.forEach(s => s.classList.remove('active'));
                stepElements[step].classList.add('active');
                console.log('Step:', step);
            } else {
                clearInterval(interval);
                console.log('Verification complete, capturing photo');
                setTimeout(() => {
                    captureAndSaveFace();
                }, 2000);
            }
        }, 3000);
    }, 300);
}

function showVerificationSuccess() {
    const verificationArea = document.getElementById('verificationArea');
    if (!verificationArea) {
        console.error('Verification area not found');
        return;
    }
    
    const canAddMore = registeredFaces.length < maxFaceIds;
    
    verificationArea.innerHTML = `
        <div class="verification-complete">
            <div class="verification-complete-icon">
                <i class="ri-check-line"></i>
            </div>
            <h2 style="font-size: 28px; font-weight: 600; margin-bottom: 16px; color: #1a1a1a;">Verification Complete!</h2>
            <p style="color: #6b7280; margin-bottom: 32px; font-size: 15px;">Your face has been verified successfully. ${registeredFaces.length}/${maxFaceIds} Face IDs registered.</p>
            
            <div class="face-management">
                <div class="face-management-header">
                    <div class="face-management-title">Registered Faces</div>
                    <div class="face-count">${registeredFaces.length}/${maxFaceIds}</div>
                </div>
                <div class="face-list">
                    ${registeredFaces.map((face, index) => `
                        <div class="face-item">
                            <img src="${face.image}" alt="Face ${index + 1}">
                            <button class="face-item-remove" onclick="removeFace(${face.id})">
                                <i class="ri-close-line"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
                ${canAddMore ? `
                    <button class="add-face-btn" onclick="addAnotherFace()">
                        <i class="ri-add-line"></i> Add Another Face ID
                    </button>
                ` : `
                    <div class="plan-limit-warning">
                        <i class="ri-alert-line"></i> Maximum Face IDs reached for ${selectedPlan} plan. Please upgrade to add more.
                    </div>
                `}
            </div>
            
            <button class="btn btn-primary" style="margin-top: 24px;" onclick="goToDashboard()">Access Business Dashboard</button>
        </div>
    `;
}

function removeFace(faceId) {
    if (confirm('Are you sure you want to remove this Face ID?')) {
        registeredFaces = registeredFaces.filter(face => face.id !== faceId);
        saveRegisteredFaces();
        showVerificationSuccess();
    }
}

function addAnotherFace() {
    if (registeredFaces.length >= maxFaceIds) {
        alert(`Maximum Face IDs (${maxFaceIds}) reached for ${selectedPlan} plan. Please upgrade to add more.`);
        return;
    }
    
    const verificationArea = document.getElementById('verificationArea');
    verificationArea.innerHTML = `
        <h2 style="font-size: 28px; font-weight: 600; margin-bottom: 16px;">Add Another Face ID</h2>
        <p style="color: #6b7280; margin-bottom: 32px;">Please follow the instructions to add another face</p>
        
        <div class="camera-container">
            <video id="cameraFeed" class="camera-feed" autoplay playsinline></video>
            <canvas id="cameraCanvas" style="display: none;"></canvas>
            <div class="face-guide"></div>
        </div>

        <div class="verification-instruction" id="verificationInstruction">Look straight ahead</div>
        
        <div class="verification-steps">
            <div class="verification-step active" id="step1"></div>
            <div class="verification-step" id="step2"></div>
            <div class="verification-step" id="step3"></div>
        </div>
    `;
    
    startCamera();
    
    let step = 0;
    const instructions = ['Look straight ahead', 'Turn your face left', 'Turn your face right'];
    const instructionElement = document.getElementById('verificationInstruction');
    const stepElements = document.querySelectorAll('.verification-step');
    
    const interval = setInterval(() => {
        step++;
        if (step < 3) {
            instructionElement.textContent = instructions[step];
            stepElements.forEach(s => s.classList.remove('active'));
            stepElements[step].classList.add('active');
        } else {
            clearInterval(interval);
            setTimeout(() => {
                captureAndSaveFace();
            }, 2000);
        }
    }, 3000);
}

function goToDashboard() {
    const planData = {
        plan: selectedPlan,
        price: selectedPrice,
        maxFaceIds: maxFaceIds,
        purchaseDate: new Date().toISOString()
    };
    
    try {
        localStorage.setItem('queuepilot_purchased_plan', JSON.stringify(planData));
        console.log('Plan saved:', planData);
        
        verificationModal.classList.remove('active');
        stopCamera();
        
        alert('Setup complete! Redirecting to dashboard...');
        window.location.href = '../admin/index.html';
    } catch (e) {
        console.error('Error saving plan:', e);
        alert('Error saving plan data. Please try again.');
    }
}

document.getElementById('companyType')?.addEventListener('change', function() {
    const otherGroup = document.getElementById('otherCompanyGroup');
    const otherDetails = document.getElementById('otherCompanyDetails');
    if (this.value === 'Other') {
        otherGroup.classList.add('show');
        otherDetails.required = true;
    } else {
        otherGroup.classList.remove('show');
        otherDetails.required = false;
    }
});

document.getElementById('companyDoc')?.addEventListener('change', function() {
    const fileName = document.getElementById('fileName');
    const preview = document.getElementById('documentPreview');
    const previewImage = document.getElementById('previewImage');
    
    if (this.files.length > 0) {
        const file = this.files[0];
        fileName.innerHTML = '<i class="ri-file-check-line"></i> ' + file.name;
        fileName.style.display = 'flex';
        
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewImage.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            preview.style.display = 'none';
        }
    } else {
        fileName.style.display = 'none';
        preview.style.display = 'none';
    }
});

paymentModal?.addEventListener('click', function(e) {
    if (e.target === paymentModal) {
        closePaymentModal();
    }
});

function animateStats() {
    const stats = document.querySelectorAll('.stat-number');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = parseInt(entry.target.getAttribute('data-target'));
                animateNumber(entry.target, target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    stats.forEach(stat => observer.observe(stat));
}

function animateNumber(element, target) {
    let current = 0;
    const increment = target / 50;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target + '+';
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current) + '+';
        }
    }, 30);
}

function loadUserFromMemory() {
    const savedUser = localStorage.getItem('queuepilot_user');
    if (savedUser) {
        const user = JSON.parse(savedUser);
        currentUser = user;
        userIcon.style.display = 'none';
        userProfile.style.display = 'block';
        userAvatar.src = user.avatar;
        userName.textContent = user.name;
        updateReviewForm();
    }
}

function saveUserToMemory(user) {
    localStorage.setItem('queuepilot_user', JSON.stringify(user));
}

function loadReviewsFromMemory() {
    const savedReviews = localStorage.getItem('queuepilot_reviews');
    if (savedReviews) {
        allReviews = JSON.parse(savedReviews);
    } else {
        allReviews = [
            {
                name: "Dr. Amish Lamsal",
                avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Amish",
                text: "QueuePilot transformed our hospital operations. Patient wait times reduced by 60% and satisfaction scores increased dramatically. The token system is intuitive and the help desk support is excellent."
            },
            {
                name: "Mison Khatiwada",
                avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mison",
                text: "Outstanding queue management solution! Our bank branches now handle 3x more customers efficiently. The AI-powered notifications keep customers informed and happy. Best investment we made this year."
            },
            {
                name: "Rajesh Shrestha",
                avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rajesh",
                text: "Perfect for our government office. Citizens love the digital token system - no more physical lines or confusion. The analytics help us optimize staffing. Integration was seamless and support is responsive."
            },
            {
                name: "Priya Maharjan",
                avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya",
                text: "Game changer for our clinic network. The multi-counter management and real-time updates are exactly what we needed. Patients can track their position from anywhere. Highly recommend for healthcare facilities."
            },
            {
                name: "Sandip Gurung",
                avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sandip",
                text: "Exceptional technology and customer service. The token-based system eliminated crowding at our service centers. The help desk feature resolved our customer support challenges completely. Absolutely worth every rupee!"
            }
        ];
        saveReviewsToMemory();
    }
    renderReviews();
}

function saveReviewsToMemory() {
    localStorage.setItem('queuepilot_reviews', JSON.stringify(allReviews));
}

function renderReviews() {
    reviewsSlider.innerHTML = '';
    reviewDots.innerHTML = '';
    
    allReviews.forEach((review, index) => {
        const reviewCard = document.createElement('div');
        reviewCard.className = `review-card ${index === 0 ? 'active' : ''}`;
        reviewCard.innerHTML = `
            <div class="review-header">
                <img src="${review.avatar}" alt="${review.name}" class="review-avatar">
                <div class="review-author">${review.name}</div>
            </div>
            <div class="review-text">${review.text}</div>
        `;
        reviewsSlider.appendChild(reviewCard);
        
        const dot = document.createElement('div');
        dot.className = `review-dot ${index === 0 ? 'active' : ''}`;
        dot.setAttribute('data-index', index);
        dot.addEventListener('click', () => showReview(index));
        reviewDots.appendChild(dot);
    });
}

function initializeGoogleSignIn() {
    google.accounts.id.initialize({
        client_id: '1091162397024-te53me83sai0uhfmpk0rv7evvre59aeg.apps.googleusercontent.com',
        callback: handleGoogleSignIn,
        auto_select: false,
        cancel_on_tap_outside: true
    });

    google.accounts.id.renderButton(
        document.getElementById('googleSignInDiv'),
        {
            theme: 'outline',
            size: 'large',
            width: '100%',
            type: 'standard'
        }
    );
}

function handleGoogleSignIn(response) {
    const credential = response.credential;
    const payload = JSON.parse(atob(credential.split('.')[1]));
    
    const user = {
        name: payload.name,
        email: payload.email,
        avatar: payload.picture,
        type: 'google'
    };
    
    loginUser(user);
}

function setupEventListeners() {
    userIcon.addEventListener('click', () => {
        loginModal.classList.add('active');
    });

    loginPromptBtn.addEventListener('click', () => {
        loginModal.classList.add('active');
    });

    loginClose.addEventListener('click', () => {
        loginModal.classList.remove('active');
    });

    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.classList.remove('active');
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('#userAvatar')) {
            userDropdown.classList.toggle('active');
        } else if (!e.target.closest('#userDropdown')) {
            userDropdown.classList.remove('active');
        }
    });

    emailLoginBtn.addEventListener('click', handleEmailLogin);

    logoutBtn.addEventListener('click', handleLogout);

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

function handleEmailLogin() {
    const email = emailInput.value.trim();
    if (email && email.includes('@')) {
        const name = email.split('@')[0];
        const user = {
            name: name.charAt(0).toUpperCase() + name.slice(1),
            email: email,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
            type: 'email'
        };
        loginUser(user);
        emailInput.value = '';
    } else {
        alert('Please enter a valid email address');
    }
}

function loginUser(user) {
    currentUser = user;
    saveUserToMemory(user);
    userIcon.style.display = 'none';
    userProfile.style.display = 'block';
    userAvatar.src = user.avatar;
    userName.textContent = user.name;
    loginModal.classList.remove('active');
    updateReviewForm();
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('queuepilot_user');
    userIcon.style.display = 'flex';
    userProfile.style.display = 'none';
    userDropdown.classList.remove('active');
    updateReviewForm();
    google.accounts.id.disableAutoSelect();
}

function updateReviewForm() {
    if (currentUser) {
        reviewFormArea.innerHTML = `
            <form class="review-form" id="reviewForm">
                <input type="text" id="reviewName" placeholder="Your name" value="${currentUser.name}" readonly>
                <textarea id="reviewText" placeholder="Share your experience with QueuePilot..." required></textarea>
                <button type="submit">Submit Review</button>
            </form>
        `;
        
        document.getElementById('reviewForm').addEventListener('submit', handleReviewSubmit);
    } else {
        reviewFormArea.innerHTML = `
            <div class="login-required">
                <i class="ri-lock-line"></i>
                <p>Please sign in to post a review</p>
                <button class="btn btn-primary" id="loginPromptBtn">Sign In</button>
            </div>
        `;
        
        document.getElementById('loginPromptBtn').addEventListener('click', () => {
            loginModal.classList.add('active');
        });
    }
}

function handleReviewSubmit(e) {
    e.preventDefault();
    
    const text = document.getElementById('reviewText').value.trim();
    
    if (text) {
        const newReview = {
            name: currentUser.name,
            avatar: currentUser.avatar,
            text: text
        };
        
        allReviews.unshift(newReview);
        saveReviewsToMemory();
        renderReviews();
        showReview(0);
        stopReviewRotation();
        setTimeout(startReviewRotation, 5000);
        
        document.getElementById('reviewText').value = '';
        alert('Thank you for your review!');
    }
}

function showReview(index) {
    const reviewCards = document.querySelectorAll('.review-card');
    const dots = document.querySelectorAll('.review-dot');
    
    reviewCards.forEach((card, i) => {
        card.classList.remove('active', 'prev', 'next');
        if (i < index) {
            card.classList.add('prev');
        } else if (i > index) {
            card.classList.add('next');
        }
    });
    
    dots.forEach(dot => dot.classList.remove('active'));
    
    if (dots[index]) dots[index].classList.add('active');
    if (reviewCards[index]) reviewCards[index].classList.add('active');
    
    currentReviewIndex = index;
}

function nextReview() {
    let nextIndex = currentReviewIndex + 1;
    if (nextIndex >= allReviews.length) nextIndex = 0;
    showReview(nextIndex);
}

function startReviewRotation() {
    reviewInterval = setInterval(nextReview, 3000);
}

function stopReviewRotation() {
    clearInterval(reviewInterval);
}

document.querySelector('.reviews-carousel')?.addEventListener('mouseenter', stopReviewRotation);
document.querySelector('.reviews-carousel')?.addEventListener('mouseleave', startReviewRotation);

window.addEventListener('load', initializeApp);

window.addEventListener('beforeunload', () => {
    stopCamera();
});