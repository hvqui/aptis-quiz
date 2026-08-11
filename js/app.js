let allQuestions = [];
let currentQuestions = [];
let submitted = false;

// Thứ tự 12 chủ đề theo bảng STT người dùng cung cấp.
const TOPIC_ORDER = [
    "Thời gian / Thứ ngày / Thời lượng",
    "Giá tiền / Số lượng / Con số / Tuổi / Số điện thoại",
    "Địa điểm / Khu vực / Phòng / Tầng / Đi đâu",
    "Phương tiện / Cách di chuyển",
    "Đồ vật / Món ăn / Đồ uống / Mua - Mất - Quên - Chuẩn bị - Sửa",
    "Nghề nghiệp / Khóa học / Môn học / Yêu cầu học tập - Công việc",
    "Lý do / Mục đích / Nguyên nhân / Lời khuyên / Điều chỉnh",
    "Hoạt động / Thói quen / Kế hoạch / Việc sẽ làm",
    "Sở thích / Cảm xúc / Ý kiến / Đặc điểm / Thời tiết",
    "Màu sắc / Ngoại hình / Điểm giống nhau",
    "Ai / Người nào / Sống với ai / Chụp ai",
    "Câu thiếu / mờ / cần kiểm tra lại từ ảnh gốc"
];

function getTopicOrder(topic) {
    const index = TOPIC_ORDER.indexOf(topic);
    return index === -1 ? 999 : index;
}

function sortQuestionsByTopic(questions) {
    return [...questions].sort((a, b) => {
        const topicCompare = getTopicOrder(a.topic) - getTopicOrder(b.topic);
        if (topicCompare !== 0) return topicCompare;
        return Number(a.id) - Number(b.id);
    });
}


const form = document.getElementById("quizForm");
const topicFilter = document.getElementById("topicFilter");
const quizInfo = document.getElementById("quizInfo");
const resultSummary = document.getElementById("resultSummary");
const submitBtn = document.getElementById("submitBtn");
const retakeBtn = document.getElementById("retakeBtn");

async function loadQuestions() {
    try {
        const response = await fetch("data/questions.json");

        if (!response.ok) {
            throw new Error("Không thể đọc questions.json");
        }

        allQuestions = await response.json();

        const topics = TOPIC_ORDER.filter(topic =>
            allQuestions.some(q => q.topic === topic)
        );

        const extraTopics = [...new Set(allQuestions.map(q => q.topic))]
            .filter(topic => !TOPIC_ORDER.includes(topic));

        topicFilter.innerHTML = '<option value="ALL">Tất cả chủ đề</option>';

        [...topics, ...extraTopics].forEach(topic => {
            const option = document.createElement("option");
            option.value = topic;
            const stt = TOPIC_ORDER.indexOf(topic);
            option.textContent = stt >= 0 ? `${stt + 1}. ${topic}` : topic;
            topicFilter.appendChild(option);
        });

        renderQuiz();
    } catch (error) {
        quizInfo.textContent = "❌ Không thể tải danh sách câu hỏi.";
        console.error(error);
    }
}

function renderQuiz() {
    submitted = false;
    resultSummary.classList.add("hidden");
    resultSummary.innerHTML = "";

    const selectedTopic = topicFilter.value;

    currentQuestions = selectedTopic === "ALL"
        ? sortQuestionsByTopic(allQuestions)
        : sortQuestionsByTopic(
            allQuestions.filter(q => q.topic === selectedTopic)
        );

    quizInfo.textContent =
        `Tổng số câu: ${currentQuestions.length} | Chủ đề: ${selectedTopic === "ALL" ? "Tất cả" : selectedTopic
        }`;

    form.innerHTML = currentQuestions.map((q, index) => {
        const optionsHtml = q.options.map((option, optionIndex) => `
            <label class="option" data-question="${q.id}" data-option="${optionIndex}">
                <input
                    type="radio"
                    name="question_${q.id}"
                    value="${optionIndex}"
                >
                ${String.fromCharCode(65 + optionIndex)}. ${escapeHtml(option)}
            </label>
        `).join("");

        return `
            <div class="question" id="question-${q.id}">
                <div class="question-header">
                    <div class="question-number">
                        <span class="topic">${escapeHtml(q.topic)}</span><br>
                        Câu ${index + 1}. ${escapeHtml(q.question)}
                    </div>

                    <span class="answer-result" id="result-${q.id}"></span>
                </div>

                ${optionsHtml}

                <div class="correct-answer-text" id="answer-${q.id}"></div>
            </div>
        `;
    }).join("");

    form.querySelectorAll("input[type=radio]").forEach(input => {
        input.addEventListener("change", () => {
            if (!submitted) {
                input.closest(".question").classList.remove(
                    "correct-question",
                    "wrong-question",
                    "unanswered-question"
                );
            }
        });
    });
}

function submitQuiz() {
    if (submitted) return;

    submitted = true;

    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    let notGraded = 0;

    currentQuestions.forEach(q => {
        const questionBox = document.getElementById(`question-${q.id}`);
        const result = document.getElementById(`result-${q.id}`);
        const answerText = document.getElementById(`answer-${q.id}`);

        questionBox.classList.remove(
            "correct-question",
            "wrong-question",
            "unanswered-question"
        );

        questionBox.querySelectorAll(".option").forEach(option => {
            option.classList.remove("correct-answer", "wrong-answer");
        });

        /*
         * Một số câu trong PDF bị thiếu dữ liệu.
         * Ví dụ: câu 135, 151, 157 có answer = null.
         * Không được gọi querySelector() với đáp án null,
         * vì khi đó correctOption sẽ là null và gây lỗi:
         * "Cannot read properties of null (reading 'classList')".
         */
        const hasValidAnswer =
            Number.isInteger(q.answer) &&
            q.answer >= 0 &&
            q.answer < q.options.length;

        if (!hasValidAnswer) {
            notGraded++;

            // Nếu JSON có answerText thì hiển thị đáp án dạng chữ.
            if (q.answerText && q.answerText !== "[Không xác định]") {
                answerText.innerHTML =
                    `<b class="correct-label">Đáp án trong tài liệu: ${escapeHtml(q.answerText)}</b>`;
            } else {
                answerText.innerHTML =
                    `<b>⚠ Câu này chưa có đủ dữ liệu để chấm.</b>`;
            }

            result.textContent = "⚠ Chưa có đáp án";
            result.className = "answer-result unanswered";

            questionBox.classList.add("unanswered-question");
            return;
        }

        // Hiển thị đáp án đúng.
        const correctLetter = String.fromCharCode(65 + q.answer);

        answerText.innerHTML =
            `<b class="correct-label">Đáp án đúng: ${correctLetter}. ${escapeHtml(q.options[q.answer])}</b>`;

        // Tô màu đáp án đúng.
        const correctOption = questionBox.querySelector(
            `.option[data-option="${q.answer}"]`
        );

        // Vì đã kiểm tra hasValidAnswer nên correctOption phải tồn tại.
        if (correctOption) {
            correctOption.classList.add("correct-answer");
        }

        const selected = document.querySelector(
            `input[name="question_${q.id}"]:checked`
        );

        if (!selected) {
            unanswered++;
            questionBox.classList.add("unanswered-question");

            result.textContent = "⚠ Chưa trả lời";
            result.className = "answer-result unanswered";
            return;
        }

        const selectedIndex = Number(selected.value);

        if (selectedIndex === q.answer) {
            correct++;
            questionBox.classList.add("correct-question");

            result.textContent = "✓ Đúng";
            result.className = "answer-result correct";
        } else {
            wrong++;
            questionBox.classList.add("wrong-question");

            const selectedOption = questionBox.querySelector(
                `.option[data-option="${selectedIndex}"]`
            );

            if (selectedOption) {
                selectedOption.classList.add("wrong-answer");
            }

            result.textContent = "✗ Sai";
            result.className = "answer-result wrong";
        }
    });

    /*
     * Chỉ các câu có đáp án hợp lệ mới được tính điểm.
     * 159 câu trong PDF hiện có 156 câu có thể chấm,
     * còn 3 câu thiếu dữ liệu.
     */
    const totalQuestions = currentQuestions.length;
    const gradedQuestions = totalQuestions - notGraded;

    // Mỗi câu đúng = 1 điểm.
    // Điểm tối đa = tổng số câu được chấm.
    const score = correct;

    resultSummary.innerHTML = `
        <div class="score">Điểm: ${score}/${gradedQuestions}</div>

        <div>
            <span class="correct-count">✓ Đúng: ${correct}</span>
            &nbsp;&nbsp; | &nbsp;&nbsp;

            <span class="wrong-count">✗ Sai: ${wrong}</span>
            &nbsp;&nbsp; | &nbsp;&nbsp;

            <span class="unanswered-count">
                ⚠ Chưa trả lời: ${unanswered}
            </span>

            ${notGraded > 0
            ? `
                &nbsp;&nbsp; | &nbsp;&nbsp;
                <span class="unanswered-count">
                    ⚠ Chưa có dữ liệu: ${notGraded}
                </span>
                `
            : ""
        }
        </div>

        <p>
            Tổng số câu: <b>${totalQuestions}</b> |
            Số câu được chấm: <b>${gradedQuestions}</b> (mỗi câu đúng = 1 điểm)
        </p>

        <small>
            🟢 Xanh = đáp án đúng &nbsp;|&nbsp;
            🔴 Đỏ = đáp án bạn chọn sai &nbsp;|&nbsp;
            🟡 Vàng = chưa trả lời / chưa có dữ liệu.
        </small>
    `;

    resultSummary.classList.remove("hidden");

    // Khóa lựa chọn sau khi chấm.
    form.querySelectorAll("input[type=radio]").forEach(input => {
        input.disabled = true;
    });

    submitBtn.textContent = "✅ Đã chấm";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function retake() {
    renderQuiz();
    submitBtn.textContent = "✅ Chấm bài";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

topicFilter.addEventListener("change", renderQuiz);
submitBtn.addEventListener("click", submitQuiz);
retakeBtn.addEventListener("click", retake);

loadQuestions();
