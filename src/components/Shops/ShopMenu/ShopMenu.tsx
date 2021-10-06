import { useEffect, useState } from "react"
import { Card, Button, ListGroup,  } from "react-bootstrap"
import { useAppSelector } from "../../../redux/app/hooks"
import { IMenu } from "../../../typings/menu"
import Item from "../Item/Item"
import ItemList from "../ItemList/ItemList"
import ItemModal from "../ItemModal/ItemModal"

interface ShopMenuProps {
    shopId: string
}
const ShopMenu = ({shopId}:ShopMenuProps) => {

    const shop = useAppSelector(state => state.shops.data.find(shop => shop._id === shopId))
   
    const [show, setShow] = useState(false);
    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    
    return (
        <>
            <Card.Title className="m-5"> MENU </Card.Title>
            <div className="my-3 text-align-end">
                <Button onClick={handleShow}>Add Menu Item</Button>
            </div>
            <ListGroup className="px-0" variant="flush">
                {shop?.menu.map(menuItem => (
                    <ListGroup.Item className="px-0 menu-item">
                        <Item itemId={menuItem._id} shopId={shopId} />
                    </ListGroup.Item>
                ))}
            </ListGroup>
            <ItemModal shopId={shopId} show={show} handleClose={handleClose} itemId={"new"}/>
        </>
    )
}

export default ShopMenu