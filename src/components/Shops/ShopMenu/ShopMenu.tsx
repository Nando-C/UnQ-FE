import { Card } from "react-bootstrap"
import ItemList from "../ItemList/ItemList"

const ShopMenu = () => {
    return (
        <>
        <Card>
            <Card.Body>
                <Card.Title>Category</Card.Title>
                <ItemList/>
            </Card.Body>
        </Card>
        </>
    )
}

export default ShopMenu