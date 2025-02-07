    import animals from "../../../animals.json"

    export function getName() {
        return animals[Math.floor(Math.random() * animals.length)]
    }

    export function getColor() {
        return Math.floor(Math.random() * 360)
    }