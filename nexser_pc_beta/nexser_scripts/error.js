function displayBlueScreen(message, source, lineno, colno, error) {
    if (document.querySelector('.blue-screen')) {
        return;
    }
    const blueScreen = document.createElement('div');
    blueScreen.className = 'blue-screen';
    blueScreen.innerHTML = `<div>
            <p style="background: silver; display: inline; color: darkblue;">&nbsp;nexser&nbsp;</p>
            <p>エラーが発生しました。ページを再ロードしてください。</p>
            <p>エラー情報：</p>
            <p>${message}</p>
            <p>ソース：${source}</p>
            <p>行番号：${lineno}</p>
            <p>列番号：${colno}</p>
            <p>${error ? error.stack : ''}</p>
        </div>`;
    document.querySelectorAll('.testwindow2').forEach(task_buttons => task_buttons.remove());
    document.body.appendChild(blueScreen);
    document.getElementById('nex').remove();
    playbluescreen();
}

function handleError(event) {
    displayBlueScreen(event.message, event.filename, event.lineno, event.colno, event.error);
    const errorType = event.error instanceof SyntaxError ? "構文エラー" :
        event.error instanceof TypeError ? "型エラー" :
            event.error instanceof ReferenceError ? "参照エラー" : "その他のエラー";
    console.error(`重大なエラー: ${errorType}が発生しました。`);
    return false;
}

window.addEventListener('error', handleError);
window.addEventListener('unhandledrejection', function (event) {
    displayBlueScreen(event.reason.message, '', 0, 0, event.reason);
    console.error('Unhandled promise rejection: ', event.reason);
});
window.addEventListener('DOMContentLoaded', () => {
    try {
        // ページ初期化
    } catch (e) {
        console.error('Initialization error: ', e);
        displayBlueScreen(e.message, 'Initialization code', 0, 0, e);
    }
});