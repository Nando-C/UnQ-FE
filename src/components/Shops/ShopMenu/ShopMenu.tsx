import { useEffect, useState } from "react"
import { Card } from "react-bootstrap"
import { IMenu } from "../../../typings/menu"
import ItemList from "../ItemList/ItemList"

// interface ShopMenuProps {
//     menu: IMenu[]
// }
const ShopMenu = (menu: IMenu[]) => {
    const [menuList, setMenu] = useState([])
    
    useEffect(()=> {
        // setMenu(menu)
    }, [menu])

    
    return (
        <>
            <Card>
                <Card.Body>
                    <Card.Title>Category</Card.Title>
                    {/* {menu.map((item) => (
                        <ItemList item={item}/>
                    ))} */}
                </Card.Body>
            </Card>
        </>
    )
}

export default ShopMenu