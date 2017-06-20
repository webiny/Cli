class Menu {
    constructor(title) {
        this.title = title;
        this.lineBefore = false;
        this.lineAfter = false;
    }

    getTitle() {
        return this.title;
    }

    addLineBefore() {
        this.lineBefore = true;
        return this;
    }

    addLineAfter() {
        this.lineAfter = true;
        return this;
    }

    getLineBefore() {
        return this.lineBefore;
    }

    getLineAfter() {
        return this.lineAfter;
    }
}

module.exports = Menu;