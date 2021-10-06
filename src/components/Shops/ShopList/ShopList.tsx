import { ListGroup } from "react-bootstrap"
import { Link } from "react-router-dom"
import { useAppSelector } from "../../../redux/app/hooks"
import { selectShopsData } from "../../../redux/slices/shopSlice"
import ShopCard from "../ShopCard/ShopCard"
import "./ShopList.css"

const ShopList = () => {

    const shopListStore = useAppSelector(selectShopsData)

    return (
        <>
        <ListGroup className="ShopList px-3" variant="flush">
            {shopListStore.map((shop) => (
                <ListGroup.Item key={shop._id}>
                    <Link to={`/shop/${shop._id}`}>
                        <ShopCard
                            // _id={shop._id}
                            name={shop.name}
                            cover={shop.cover}
                            bio={shop.bio}
                        />
                    </Link>
                </ListGroup.Item>
            ))}
        </ListGroup>
        </>
    )
}

export default ShopList