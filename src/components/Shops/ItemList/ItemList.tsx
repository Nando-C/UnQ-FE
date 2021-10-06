import { ListGroup } from "react-bootstrap"
import Item from "../Item/Item"
import "./ItemList.css"

const ItemList = () => {
    return (
        <>
        <ListGroup className="px-3" variant="flush">
            {/* <ListGroup.Item>
                <Item/>
            </ListGroup.Item>
            <ListGroup.Item>
                <Item/>
            </ListGroup.Item>
            <ListGroup.Item>
                <Item/>
            </ListGroup.Item>
            <ListGroup.Item>
                <Item/>
            </ListGroup.Item>
            <ListGroup.Item>
                <Item/>
            </ListGroup.Item> */}
        </ListGroup>
        </>
    )
}

export default ItemList