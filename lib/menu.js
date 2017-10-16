class Menu {
    constructor(title) {
        this.order = 100;
        this.title = title;
        this.lineBefore = false;
        this.lineAfter = false;
    }

    setOrder(order) {
        this.order = order;
        return this;
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