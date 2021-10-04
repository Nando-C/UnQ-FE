import { ListGroup } from "react-bootstrap"
import { useAppSelector } from "../../../redux/app/hooks"
import { selectShopsData } from "../../../redux/slices/shopSlice"
import ShopCard from "../ShopCard/ShopCard"
import "./ShopList.css"

const ShopList = () => {

    const shopListStore = useAppSelector(selectShopsData)

    return (
        <>
        <ListGroup className="px-3" variant="flush">
            {shopListStore.map((shop) => (
                <ListGroup.Item>
                    <ShopCard 
                        key={shop._id}
                        // _id={shop._id}
                        name={shop.name}
                        cover={shop.cover}
                        bio={shop.bio}
                    />
                </ListGroup.Item>
            ))}
            {/* <ListGroup.Item>
                <ShopCard/>
            </ListGroup.Item>
            <ListGroup.Item>
                <ShopCard/>
            </ListGroup.Item>
            <ListGroup.Item>
                <ShopCard/>
            </ListGroup.Item>
            <ListGroup.Item>
                <ShopCard/>
            </ListGroup.Item> */}
        </ListGroup>
        </>
    )
}

export default ShopList