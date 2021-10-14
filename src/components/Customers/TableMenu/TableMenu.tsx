import { useEffect, useState } from "react"
import { Card, Col, Container, FloatingLabel, Form, Image, ListGroup, Row } from "react-bootstrap"
import { useDispatch } from "react-redux"
import { useParams } from "react-router"
import { useAppSelector } from "../../../redux/app/hooks"
import { storeCartPointers } from "../../../redux/slices/cartSlice"
import { fetchSingleShop, selectSelectedShop } from "../../../redux/slices/shopSlice"
import MenuItem from "../MenuItem/MenuItem"
import "./TableMenu.css"

const TableMenu = () => {

    const params = useParams<{ shopId: string, tableId: string }>()
    const shopId  = params.shopId
    const tableId  = params.tableId
    console.log("shopId: ", shopId)
    console.log("tableId: ", tableId)
    
    
    const [query, setQuery] = useState("")
    
    const dispatch = useDispatch()
    dispatch(storeCartPointers(params))
    useEffect(() => {
        dispatch(fetchSingleShop(shopId))
    }, [])

    const shop = useAppSelector(selectSelectedShop)
    // console.log("This Shop: ", shop)
    
    return(
        <>
         <hr />
            {/* <Container className="p-3"> */}
                <Image src={shop?.cover} fluid />
            {/* </Container> */}
            <Card.Title className="my-3">{shop?.name}</Card.Title>
            <Card.Subtitle className="m-2"> MENU </Card.Subtitle>
            <Row>
                <Col>
                    <Form.Group className="mb-3" controlId="formBasicEmail">
                            <FloatingLabel controlId="floatingInput" label="Search Menu">
                                <Form.Control
                                    placeholder="Search Menu"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                />
                            </FloatingLabel>
                        </Form.Group>
                </Col>
            </Row>
            <ListGroup className="px-0" variant="flush">
                {shop?.menu.filter(menu => (
                            menu.category.toLowerCase().includes(query.toLowerCase()) 
                            || menu.name.toLowerCase().includes(query.toLowerCase()) 
                            || menu.short_description.toLowerCase().includes(query.toLowerCase())
                        )
                    ).map(menuItem => (
                        <ListGroup.Item key={menuItem._id} className="px-0 menu-item">
                            <MenuItem shopId={shopId} itemId={menuItem._id} />
                        </ListGroup.Item>
                ))}
            </ListGroup>
        </>
    )
}

export default TableMenu